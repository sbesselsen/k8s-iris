import * as k8s from "@kubernetes/client-node";
import {
    KubeConfig,
    KubernetesObject,
    ListPromise,
    Log,
    PortForward,
} from "@kubernetes/client-node";
import * as request from "request";
import * as net from "net";
import * as querystring from "querystring";
import { exec as execChildProcess } from "child_process";
import { Exec } from "@kubernetes/client-node";
import { PassThrough, pipeline } from "stream";
import { isMatch } from "matcher";

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { coalesce, sleep } from "../../common/util/async";

import {
    K8sClient,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListWatch,
    K8sObjectListWatcher,
    K8sObjectListWatcherMessage,
    K8sPatchOptions,
    K8sRemoveOptions,
    K8sRemoveStatus,
    K8sExecSpec,
    K8sExecHandler,
    K8sExecCommandSpec,
    K8sExecCommandStatus,
    K8sExecCommandResult,
    K8sLogSpec,
    K8sLogOptions,
    K8sLogResult,
    K8sLogWatchOptions,
    K8sLogWatch,
    K8sPortForwardSpec,
    K8sPortForwardEntry,
    K8sPortForwardStats,
    K8sPortForwardWatcher,
    K8sPortForwardWatch,
    K8sVersion,
} from "../../common/k8s/client";
import {
    fetchApiList,
    fetchApiResourceList,
    K8sApi,
    K8sApiResource,
} from "./meta";
import {
    addListObject,
    deleteListObject,
    updateListObject,
} from "../../common/k8s/util";
import { deepEqual } from "../../common/util/deep-equal";
import {
    kubeRequestOpts,
    fieldSelectorToString,
    labelSelectorToString,
} from "./util";
import { CharmPatchedExecAuth } from "./authenticator/exec";
import { toYaml } from "../../common/util/yaml";
import { shellOptions } from "../util/shell";
import { bufferToArrayBuffer } from "../util/buffer";
import { streamSplitter } from "../../common/util/stream-splitter";
import { streamStats } from "../util/stream-stats";
import getPort from "get-port";
import { debugCounters } from "../../common/util/debug";

const defaultRemoveOptions: K8sRemoveOptions = {
    waitForCompletion: true,
};

function isFullObject(body: KubernetesObject): body is K8sObject {
    return !!body && !!body.apiVersion && !!body.kind && !!body.metadata;
}

function onlyFullObject(body: KubernetesObject): K8sObject | null {
    return isFullObject(body) ? body : null;
}

/**
 * A k8s client with added options that should only be used on the backend.
 */
export type K8sBackendClient = K8sClient & {
    retryConnections(): void;
    getKubeConfig(): k8s.KubeConfig;
};

export type K8sClientOptions = {
    readonly?: boolean;
    getTempDirPath?: () => string;
};

const defaultClientOptions = {
    readonly: false,
    getTempDirPath: () => "/tmp",
};

let clientIndex = 0;

// Patch KubeConfig class with an ExecAuth class that works asynchronously.
(
    k8s.KubeConfig as unknown as { authenticators: Array<unknown> }
).authenticators.unshift(new CharmPatchedExecAuth());

export function createClient(
    kubeConfig: k8s.KubeConfig,
    options?: K8sClientOptions
): K8sBackendClient {
    const opts = {
        ...defaultClientOptions,
        ...options,
    };

    clientIndex++;

    if (opts.readonly) {
        console.log(
            "Opening in readonly mode:",
            kubeConfig.getCurrentContext()
        );
    }

    const objectApi = kubeConfig.makeApiClient(k8s.KubernetesObjectApi);
    const versionApi = kubeConfig.makeApiClient(k8s.VersionApi);

    // Allow retrying listWatch connections when signaled to do so from the outside.
    let retryConnectionsListeners: Array<() => void> = [];
    const retryConnections = () => {
        console.log("Retrying connections", kubeConfig.getCurrentContext());
        retryConnectionsListeners.forEach((l) => {
            l();
        });
        retryConnectionsListeners = [];
    };

    const listableResourcesCache: Record<
        string,
        Record<string, K8sApiResource>
    > = {};

    const listableResourceInfo = async (
        spec: K8sObjectListQuery
    ): Promise<K8sApiResource | null> => {
        if (!listableResourcesCache[spec.apiVersion]?.[spec.kind]) {
            // Load API resources.
            const api: K8sApi = {
                apiVersion: spec.apiVersion,
                version: spec.apiVersion,
            };
            const [group, version] = spec.apiVersion.split("/", 2);
            if (version) {
                api.group = group;
                api.version = version;
            }
            const resources = await fetchApiResourceList(kubeConfig, api);
            listableResourcesCache[spec.apiVersion] = Object.fromEntries(
                resources
                    .filter(
                        (res) =>
                            res.name.indexOf("/") === -1 &&
                            res.misc.verbs &&
                            res.misc.verbs.includes("list")
                    )
                    .map((res) => [res.kind, res])
            );
        }

        return listableResourcesCache[spec.apiVersion]?.[spec.kind] ?? null;
    };

    const read = async (spec: K8sObject): Promise<K8sObject | null> => {
        try {
            const { body } = await objectApi.read(spec);
            return onlyFullObject(body);
        } catch (e) {
            // Return null on error.
        }
        return null;
    };

    // Run a function with a temporary kubeconfig file for the right context.
    async function withTempKubeConfig<T>(
        kubeConfig: KubeConfig,
        f: (tempKubeConfigPath: string) => Promise<T>
    ): Promise<T> {
        const tempPath = path.join(
            opts.getTempDirPath(),
            `kc-${crypto.randomBytes(16).toString("hex")}.yml`
        );

        await fs.promises.writeFile(
            tempPath,
            toYaml(JSON.parse(kubeConfig.exportConfig())),
            {
                encoding: "utf-8",
            }
        );

        try {
            const result = await f(tempPath);
            await fs.promises.unlink(tempPath);
            return result;
        } catch (e) {
            await fs.promises.unlink(tempPath);
            throw e;
        }
    }

    const apply = async (spec: K8sObject): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }

        const shellOpts = await shellOptions();

        return withTempKubeConfig(
            kubeConfig,
            (kubeConfigPath) =>
                new Promise((resolve, reject) => {
                    const process = execChildProcess(
                        `kubectl apply --kubeconfig=${kubeConfigPath} -f -`,
                        {
                            shell: shellOpts.executablePath,
                            env: shellOpts.env,
                        },
                        async (err, _stdout, stderr) => {
                            if (err) {
                                reject(stderr);
                            } else {
                                try {
                                    const result = await read(spec);
                                    if (result === null) {
                                        throw new Error(
                                            "Object not found after apply"
                                        );
                                    }
                                    resolve(result);
                                } catch (e) {
                                    reject(e);
                                }
                            }
                        }
                    );
                    const specClone = JSON.parse(JSON.stringify(spec));
                    delete specClone.metadata.managedFields;
                    process.stdin.write(toYaml(specClone));
                    process.stdin.end();
                })
        );
    };

    const patch = async (
        spec: K8sObject,
        options?: K8sPatchOptions
    ): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }
        const { forcePatch = false, serverSideApply = true } = options ?? {};
        const headers: Record<string, string> = {};
        if (serverSideApply) {
            headers["Content-type"] = "application/apply-patch+yaml";
        }
        let body: k8s.KubernetesObject;
        try {
            const specClone = JSON.parse(JSON.stringify(spec)) as K8sObject;
            delete (specClone.metadata as any).managedFields;
            const result = await objectApi.patch(
                specClone,
                undefined,
                undefined,
                "k8s-charm",
                forcePatch,
                {
                    headers,
                }
            );
            body = result.body;
        } catch (e: any) {
            if ("statusCode" in e && e.statusCode === 409) {
                // Conflict! See if the caller wants to force the patch.
                e.isConflictError = true;
                e.conflictData = e.body;
            }
            throw e;
        }
        const obj = onlyFullObject(body);
        if (obj === null) {
            throw new Error("Object not found after patch");
        }
        return obj;
    };

    const replace = async (spec: K8sObject): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }
        const { body } = await objectApi.replace(
            spec,
            undefined,
            undefined,
            "k8s-charm"
        );
        const obj = onlyFullObject(body);
        if (obj === null) {
            throw new Error("Object not found after replace");
        }
        return obj;
    };

    const redeploy = async (spec: K8sObject): Promise<void> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }

        const redeployableTypes: Record<string, string> = {
            "apps/v1:Deployment": "deployment",
            "apps/v1:StatefulSet": "statefulset",
            "apps/v1:DaemonSet": "daemonset",
            "apps/v1:ReplicaSet": "replicaset",
        };
        const fullType = spec.apiVersion + ":" + spec.kind;
        const typeCliName = redeployableTypes[fullType];
        if (!typeCliName) {
            throw new Error("Cannot redeploy: invalid resource type");
        }

        const name = spec.metadata.name;
        if (!name.match(/^[a-zA-Z0-9\-_]+$/)) {
            throw new Error("Cannot redeploy: invalid resource name");
        }
        const namespace = spec.metadata.namespace;
        if (!namespace || !namespace.match(/^[a-zA-Z0-9\-_]+$/)) {
            throw new Error("Cannot redeploy: invalid resource namespace");
        }

        const shellOpts = await shellOptions();

        return withTempKubeConfig(
            kubeConfig,
            (kubeConfigPath) =>
                new Promise((resolve, reject) => {
                    const process = execChildProcess(
                        `kubectl rollout restart ${typeCliName}/${name} -n ${namespace} --kubeconfig=${kubeConfigPath}`,
                        {
                            shell: shellOpts.executablePath,
                            env: shellOpts.env,
                        },
                        (err, _stdout, stderr) => {
                            if (err) {
                                reject(stderr);
                            } else {
                                resolve();
                            }
                        }
                    );
                    process.stdin.end();
                })
        );
    };

    const remove = async (
        spec: K8sObject,
        options?: K8sRemoveOptions
    ): Promise<K8sRemoveStatus> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }
        const { waitForCompletion } = {
            ...defaultRemoveOptions,
            ...options,
        };
        await objectApi.delete(spec);
        if (waitForCompletion) {
            while (await read(spec)) {
                await sleep(1000);
            }
        }
        return {};
    };

    const listPath = async (spec: K8sObjectListQuery): Promise<string> => {
        const resourceInfo = await listableResourceInfo(spec);
        if (resourceInfo === null) {
            throw new Error(
                `Resource ${spec.apiVersion}.${spec.kind} is not listable`
            );
        }

        const pathParts = [
            resourceInfo.api.apiVersion === "v1" ? "api" : "apis",
            resourceInfo.api.apiVersion,
        ];
        if (spec.namespaces) {
            if (!resourceInfo.namespaced) {
                throw new Error(
                    `Resource ${spec.apiVersion}.${spec.kind} is not namespaced`
                );
            }
            if (spec.namespaces.length === 1) {
                pathParts.push("namespaces");
                pathParts.push(encodeURIComponent(spec.namespaces[0]));
            }
        }
        pathParts.push(encodeURIComponent(resourceInfo.name));

        const path = pathParts.join("/");

        return path;
    };

    // Add apiVersion and kind from the query to the objects if they don't have them.
    const assignTypeFromListQuery =
        (spec: K8sObjectListQuery) =>
        (obj: K8sObject): K8sObject => {
            if (!obj.apiVersion) {
                obj.apiVersion = spec.apiVersion;
            }
            if (!obj.kind) {
                obj.kind = spec.kind;
            }
            return obj;
        };

    const list = async <T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery
    ): Promise<K8sObjectList<T>> => {
        const path = await listPath(spec);

        const opts = await kubeRequestOpts(kubeConfig);

        let labelSelectorString: string | undefined;
        const queryParams: Record<string, string> = {};
        if (spec.labelSelector && spec.labelSelector.length > 0) {
            labelSelectorString = labelSelectorToString(spec.labelSelector);
            queryParams.labelSelector = labelSelectorString;
        }

        if (spec.fieldSelector && spec.fieldSelector.length > 0) {
            queryParams.fieldSelector = fieldSelectorToString(
                spec.fieldSelector
            );
        }

        return new Promise((resolve, reject) => {
            const currentCluster = kubeConfig.getCurrentCluster();
            if (!currentCluster) {
                reject(new Error("No cluster selected"));
                return;
            }
            request.get(
                `${currentCluster.server}/${path}?` +
                    querystring.stringify(queryParams),
                opts,
                (err, _res, body) => {
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            const data = JSON.parse(body);
                            if (
                                data &&
                                data.kind === "Status" &&
                                data.status === "Failure"
                            ) {
                                reject(data);
                                return;
                            }
                            if (data.items) {
                                data.items = data.items.map(
                                    assignTypeFromListQuery(spec)
                                );
                            }
                            resolve(data);
                        } catch (e) {
                            reject(e);
                        }
                    }
                }
            );
        });
    };

    const baseListWatch = <T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ): K8sObjectListWatch => {
        let stopped = false;
        let informer: k8s.Informer<T> | undefined;

        if (spec.namespaces && spec.namespaces.length === 0) {
            console.log(
                "ListWatch: no namespaces provided, returning static empty list"
            );
            watcher(undefined, {
                list: {
                    apiVersion: spec.apiVersion,
                    kind: spec.kind,
                    items: [],
                },
            });
            return {
                stop() {},
            };
        }

        const retrySignal = async () => {
            // Send a retry signal after a certain number of seconds, or when retryConnections is called; whichever comes first.
            return new Promise<void>((resolve) => {
                // eslint-disable-next-line prefer-const
                let retryConnectionsListener: any;

                console.log("retrySignal: set");

                const timeout = setTimeout(() => {
                    console.log("retrySignal: timeout runs");
                    retryConnectionsListeners =
                        retryConnectionsListeners.filter(
                            (l) => l !== retryConnectionsListener
                        );
                    resolve();
                }, 5000);

                retryConnectionsListener = () => {
                    console.log("retrySignal: listener runs");
                    clearTimeout(timeout);
                    resolve();
                };

                retryConnectionsListeners.push(retryConnectionsListener);
            });
        };

        const passesNamespaceCheck = (obj: any) => {
            if (!spec.namespaces) {
                return true;
            }
            if (!obj?.metadata?.namespace) {
                return false;
            }
            return spec.namespaces.includes(obj.metadata.namespace);
        };

        async function startListWatch() {
            let path: string | null = null;
            let opts: request.CoreOptions;
            while (!stopped) {
                try {
                    path = await listPath(spec);
                    opts = await kubeRequestOpts(kubeConfig);
                    break;
                } catch (e) {
                    // Report the error; wait for a retry signal; try again.
                    watcher(e);
                    console.error(e);
                    await retrySignal();
                    continue;
                }
            }
            if (stopped) {
                return;
            }
            if (path === null) {
                throw new Error(
                    "Logic error: path not available when it should be"
                );
            }

            let list: K8sObjectList<T> = {
                apiVersion: spec.apiVersion,
                kind: spec.kind,
                items: [],
            };

            let labelSelectorString: string | undefined;
            const queryParams: Record<string, string> = {};
            if (spec.labelSelector && spec.labelSelector.length > 0) {
                labelSelectorString = labelSelectorToString(spec.labelSelector);
                queryParams.labelSelector = labelSelectorString;
            }

            if (spec.fieldSelector && spec.fieldSelector.length > 0) {
                queryParams.fieldSelector = fieldSelectorToString(
                    spec.fieldSelector
                );
            }

            const listFn: ListPromise<T> = () => {
                return new Promise((resolve, reject) => {
                    const currentCluster = kubeConfig.getCurrentCluster();
                    if (!currentCluster) {
                        reject(new Error("No cluster selected"));
                        return;
                    }
                    request.get(
                        `${currentCluster.server}/${path}?` +
                            querystring.stringify(queryParams),
                        opts,
                        (err, response, body) => {
                            if (err) {
                                reject(err);
                            } else {
                                try {
                                    const data = JSON.parse(body);
                                    if (
                                        data &&
                                        data.kind === "Status" &&
                                        data.status === "Failure"
                                    ) {
                                        reject(data);
                                        return;
                                    }
                                    list.items = data.items
                                        .filter(passesNamespaceCheck)
                                        .map(assignTypeFromListQuery(spec));
                                    watcher(undefined, { list });
                                    resolve({ response, body: data });
                                } catch (e) {
                                    watcher(e);
                                    reject(e);
                                }
                            }
                        }
                    );
                });
            };

            informer = k8s.makeInformer(
                kubeConfig,
                `/${path}?` + querystring.stringify(queryParams),
                listFn,
                labelSelectorString
            );

            informer.on("add", (obj) => {
                if (!passesNamespaceCheck(obj)) {
                    return;
                }
                const newList = addListObject(list, obj);
                if (list === newList) {
                    // No rerender needed.
                    return;
                }
                list = newList;
                watcher(undefined, {
                    list,
                    update: {
                        type: "add",
                        object: obj,
                    },
                });
            });
            informer.on("update", (obj) => {
                if (!passesNamespaceCheck(obj)) {
                    return;
                }
                list = updateListObject(list, obj);
                watcher(undefined, {
                    list,
                    update: {
                        type: "update",
                        object: obj,
                    },
                });
            });
            informer.on("delete", (obj) => {
                if (!passesNamespaceCheck(obj)) {
                    return;
                }
                list = deleteListObject(list, obj);
                watcher(undefined, {
                    list,
                    update: {
                        type: "remove",
                        object: obj,
                    },
                });
            });

            let silentDropCheckInterval: any = null;
            let isPerformingPlannedRestart = false;
            informer.on("connect", () => {
                console.log(
                    "Informer connect",
                    kubeConfig.getCurrentContext(),
                    spec.kind
                );

                if (silentDropCheckInterval) {
                    clearInterval(silentDropCheckInterval);
                }

                let prevResourceVersion = (informer as any)?.resourceVersion;
                silentDropCheckInterval = setInterval(() => {
                    // If the resource version is unchanged for 1 minute, kick the informer.
                    if (stopped) {
                        clearInterval(silentDropCheckInterval);
                        return;
                    }
                    const currentResourceVersion = (informer as any)
                        ?.resourceVersion;
                    if (currentResourceVersion === prevResourceVersion) {
                        // Informer has not had any updates for a minute.
                        console.log(
                            "Informer kick due to no updates for 1 minute",
                            kubeConfig.getCurrentContext(),
                            spec.kind
                        );
                        isPerformingPlannedRestart = true;
                        informer?.start();
                    }

                    prevResourceVersion = currentResourceVersion;
                }, 60000);
            });

            informer.on("error", (err: KubernetesObject) => {
                if (stopped) {
                    return;
                }
                if (isPerformingPlannedRestart) {
                    // TODO: check if error is "aborted"
                    isPerformingPlannedRestart = false;
                    if (
                        (err as any).code === "ECONNRESET" &&
                        String(err) === "Error: aborted"
                    ) {
                        // Do not trigger error; connection is aborted due to our own restart in the "Informer kick" above.
                        return;
                    }
                }
                watcher(err);
                console.error(
                    "Informer error",
                    kubeConfig.getCurrentContext(),
                    spec.kind,
                    err
                );
                // TODO: make this configurable or handlable somehow?
                // Restart informer after 5sec.
                (async () => {
                    while (!stopped) {
                        await retrySignal();
                        if (stopped) {
                            console.log(
                                "Informer stopped after retry signal",
                                kubeConfig.getCurrentContext(),
                                spec.kind
                            );
                            return;
                        }
                        console.log(
                            "Informer restarting",
                            kubeConfig.getCurrentContext(),
                            spec.kind
                        );

                        try {
                            await informer?.start();
                        } catch (e) {
                            console.error(
                                "Informer restart error",
                                kubeConfig.getCurrentContext(),
                                spec.kind,
                                e
                            );
                            continue;
                        }
                        console.log(
                            "Informer restarted",
                            kubeConfig.getCurrentContext(),
                            spec.kind
                        );
                        watcher(undefined, {
                            list,
                        });
                        break;
                    }
                })();
            });

            console.log(
                "Starting listwatch",
                kubeConfig.getCurrentContext(),
                spec.kind
            );
            await informer.start();
        }

        (async () => {
            while (!stopped) {
                try {
                    await startListWatch();
                    return;
                } catch (e) {
                    watcher(e);
                    console.error(
                        "Listwatch startup error",
                        kubeConfig.getCurrentContext(),
                        spec.kind,
                        e
                    );
                    await retrySignal();
                }
            }
        })();

        return {
            stop() {
                stopped = true;
                console.log(
                    "Stopping listwatch",
                    kubeConfig.getCurrentContext(),
                    spec.kind
                );
                informer?.stop();
            },
        };
    };

    type ReusableListWatchHandle<T extends K8sObject> = {
        spec: K8sObjectListQuery;
        watchers: Array<K8sObjectListWatcher<T>>;
        lastMessage?: {
            error: any | undefined;
            message: K8sObjectListWatcherMessage<T> | undefined;
        };
        stop: () => void;
    };
    type ReusableListWatchHandles = Record<
        string,
        Array<ReusableListWatchHandle<K8sObject>>
    >;
    const reusableListWatchHandles: ReusableListWatchHandles = {};

    const listWatchCounters = debugCounters(
        `listWatch:${kubeConfig.getCurrentContext()}:${clientIndex}`
    );

    const listWatch = <T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ): K8sObjectListWatch => {
        const key = `${spec.apiVersion}::${spec.kind}::${
            spec.namespaces?.join(",") ?? "<all>"
        }`;

        if (!reusableListWatchHandles[key]) {
            reusableListWatchHandles[key] = [];
        }

        const reusableHandle =
            reusableListWatchHandles[key].find((handle) =>
                deepEqual(handle.spec, spec)
            ) ??
            (() => {
                // Create a reusable handle.
                // eslint-disable-next-line prefer-const
                let listWatch: K8sObjectListWatch;
                const handle: ReusableListWatchHandle<K8sObject> = {
                    spec,
                    watchers: [],
                    stop() {
                        listWatch?.stop();
                    },
                };
                listWatchCounters.up(key);
                listWatch = baseListWatch(spec, (error, message) => {
                    handle.lastMessage = { error, message: message };
                    handle.watchers.forEach((h) => h(error, message));
                });
                reusableListWatchHandles[key].push(handle);
                return handle;
            })();

        // Reuse the existing handle.
        const { watchers, lastMessage } = reusableHandle;
        if (lastMessage) {
            // Send the last received message to the watcher.
            const { error, message } = lastMessage;
            if (error) {
                watcher(error);
            } else {
                watcher(error, message as K8sObjectListWatcherMessage<T>);
            }
        }
        watchers.push(watcher as K8sObjectListWatcher<K8sObject>);
        return {
            stop() {
                // Remove the watcher.
                reusableHandle.watchers = reusableHandle.watchers.filter(
                    (w) => w !== watcher
                );
                if (reusableHandle.watchers.length === 0) {
                    // Stop watching, but only after a grace period to see if new watchers subscribe.
                    setTimeout(() => {
                        if (
                            reusableListWatchHandles[key].includes(
                                reusableHandle
                            ) &&
                            reusableHandle.watchers.length === 0
                        ) {
                            // Stop watching and remove the reusable handle.
                            listWatchCounters.down(key);
                            reusableHandle.stop();
                            reusableListWatchHandles[key] =
                                reusableListWatchHandles[key].filter(
                                    (handle) => handle !== reusableHandle
                                );
                        }
                    }, 100);
                }
            },
        };
    };

    const listApiResourceTypes = async () => {
        const apis = await fetchApiList(kubeConfig);
        const resources = await Promise.all(
            apis.map((api) => fetchApiResourceList(kubeConfig, api))
        );
        return resources
            .reduce((all, resources) => all.concat(resources), [])
            .map((apiResource) => ({
                apiVersion: apiResource.api.apiVersion,
                kind: apiResource.kind,
                namespaced: apiResource.namespaced,
                isSubResource: apiResource.isSubResource,
                ...(apiResource.verbs ? { verbs: apiResource.verbs } : {}),
            }));
    };

    const exec = async (spec: K8sExecSpec): Promise<K8sExecHandler> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }

        // TODO: set some high water marks?
        const stdout = new PassThrough() as PassThrough & {
            rows: number;
            columns: number;
        };
        const stderr = new PassThrough();
        const stdin = new PassThrough();

        // Make this stream resizeable so .exec handles it properly.
        stdout.rows = 30;
        stdout.columns = 80;

        // eslint-disable-next-line prefer-const
        let socket: {
            close(): void;
        };

        let stdoutListener: ((chunk: string | Buffer) => void) | undefined;
        let stderrListener: ((chunk: string | Buffer) => void) | undefined;
        let closeListener: (status?: K8sExecCommandStatus) => void;

        const handler: K8sExecHandler = {
            onReceive(listener) {
                if (stdoutListener) {
                    throw new Error(
                        "Cannot call .onReceive() multiple times with different arguments"
                    );
                }
                stdoutListener = (chunk: string | Buffer) => {
                    listener(
                        bufferToArrayBuffer(
                            typeof chunk === "string"
                                ? Buffer.from(chunk, "utf8")
                                : chunk
                        ),
                        null
                    );
                };
                stderrListener = (chunk: string | Buffer) => {
                    listener(
                        null,
                        bufferToArrayBuffer(
                            typeof chunk === "string"
                                ? Buffer.from(chunk, "utf8")
                                : chunk
                        )
                    );
                };
                stdout.on("data", stdoutListener);
                stderr.on("data", stderrListener);
            },
            onEnd(listener) {
                closeListener = listener;
            },
            resizeTerminal(size) {
                stdout.rows = size.rows;
                stdout.columns = size.cols;
                stdout.emit("resize");
            },
            send(chunk) {
                stdin.push(Buffer.from(chunk));
            },
            async close() {
                socket?.close();
                await Promise.all([
                    new Promise((resolve) => stdin.end(resolve)),
                    new Promise((resolve) => stdout.end(resolve)),
                    new Promise((resolve) => stderr.end(resolve)),
                ]);
                closeListener?.();
            },
        };

        socket = await new Exec(kubeConfig).exec(
            spec.namespace,
            spec.podName,
            spec.containerName,
            spec.command,
            stdout,
            stderr,
            stdin,
            spec.tty ?? false,
            (status) => {
                closeListener?.({
                    status: status.status ?? "",
                    message: status.message ?? "",
                });
            }
        );
        return handler;
    };

    const execCommand = async (
        spec: K8sExecCommandSpec
    ): Promise<K8sExecCommandResult> => {
        const handler = await exec({ ...spec, tty: false });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        handler.onReceive((stdoutChunk, stderrChunk) => {
            if (stdoutChunk) {
                stdout.push(Buffer.from(stdoutChunk));
            }
            if (stderrChunk) {
                stdout.push(Buffer.from(stderrChunk));
            }
        });
        return new Promise((resolve) => {
            handler.onEnd((status) => {
                resolve({
                    status: {
                        status: status?.status ?? "",
                        message: status?.message ?? "",
                    },
                    stdout: bufferToArrayBuffer(Buffer.concat(stdout)),
                    stderr: bufferToArrayBuffer(Buffer.concat(stderr)),
                });
            });
        });
    };

    const log = async (
        spec: K8sLogSpec,
        options?: K8sLogOptions
    ): Promise<K8sLogResult> => {
        let resolveReadyPromise: () => void;
        const readyPromise = new Promise<void>((resolve) => {
            resolveReadyPromise = resolve;
        });
        const logLines: string[] = [];
        innerLogWatch(spec, {
            ...options,
            follow: false,
            onLogLine: (line) => {
                logLines.push(line);
            },
            onEnd: () => {
                resolveReadyPromise();
            },
        });
        await readyPromise;
        return { logLines };
    };

    const innerLogWatch = (
        spec: K8sLogSpec,
        options: K8sLogWatchOptions & { follow: boolean }
    ): K8sLogWatch => {
        let stopped = false;
        let ended = false;
        let request: {
            destroy: () => void;
        };

        const watch = {
            stop() {
                stopped = true;
                request?.destroy();
                if (!ended) {
                    ended = true;
                    options.onEnd();
                }
            },
        };

        (async () => {
            const log = new Log(kubeConfig);

            const logOutput = new PassThrough();
            logOutput.setEncoding("utf8");

            request = await log.log(
                spec.namespace,
                spec.podName,
                spec.containerName,
                logOutput,
                {
                    previous: options.previous ?? false,
                    timestamps: options.timestamps ?? false,
                    follow: options.follow,
                }
            );
            if (stopped) {
                return;
            }

            const optionsMatch = options.match;
            const match: (line: string) => boolean = optionsMatch
                ? (line: string) =>
                      isMatch(
                          line,
                          optionsMatch.startsWith("!")
                              ? optionsMatch
                              : "*" + optionsMatch + "*",
                          {
                              caseSensitive: false,
                          }
                      )
                : () => true;

            const splitter = streamSplitter(/[\n\r]+/, (line) => {
                if (stopped) {
                    return;
                }
                if (match(line)) {
                    options.onLogLine(line);
                }
            });
            logOutput.on("data", (chunk) => {
                splitter.push(chunk);
            });

            logOutput.on("end", () => {
                splitter.end();
                if (!ended) {
                    ended = true;
                    options.onEnd();
                }
            });
        })();

        return watch;
    };

    const logWatch = (
        spec: K8sLogSpec,
        options: K8sLogWatchOptions
    ): K8sLogWatch => {
        return innerLogWatch(spec, { ...options, follow: true });
    };

    const portForwardStats: Record<string, K8sPortForwardStats> = {};
    let portForwards: K8sPortForwardEntry[] = [];
    let portForwardWatchers: K8sPortForwardWatcher[] = [];
    let portForwardIndex = 1;
    const portForwardHandles: Record<string, { stop(): void }> = {};

    const sendPortForwardStats = coalesce(() => {
        portForwardWatchers.forEach(({ onStats }) => onStats(portForwardStats));
    }, 1000);

    const listPortForwards = async (): Promise<Array<K8sPortForwardEntry>> => {
        return portForwards;
    };

    const watchPortForwards = (
        watcher: K8sPortForwardWatcher
    ): K8sPortForwardWatch => {
        portForwardWatchers.push(watcher);
        return {
            stop() {
                portForwardWatchers = portForwardWatchers.filter(
                    (w) => w !== watcher
                );
            },
        };
    };

    const portForward = async (
        spec: K8sPortForwardSpec
    ): Promise<K8sPortForwardEntry> => {
        const id = `pfwd:${portForwardIndex++}`;
        const entry: Partial<K8sPortForwardEntry> = {
            id,
            spec,
        };

        const fetchPodNameForLabelMap = async (
            labels: Record<string, string>
        ): Promise<string | undefined> => {
            const podList = await list({
                apiVersion: "v1",
                kind: "Pod",
                namespaces: [spec.namespace],
                labelSelector: Object.entries(labels).map(([name, value]) => ({
                    name,
                    value: String(value),
                })),
            });
            if (podList.items.length === 0) {
                return;
            }
            return podList.items[0].metadata.name;
        };

        const fetchPodEndpointForService = async (
            spec: K8sPortForwardSpec
        ): Promise<{ podName: string; podPort: number } | undefined> => {
            const service = await read({
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    namespace: spec.namespace,
                    name: spec.remoteName,
                },
            });
            if (!service) {
                return;
            }
            const port = ((service as any).spec?.ports ?? []).find(
                (pt: any) => pt.port === spec.remotePort
            );
            if (!port) {
                return;
            }
            const selector = (service as any).spec?.selector;
            if (!selector) {
                return;
            }
            const podName = await fetchPodNameForLabelMap(selector);
            if (!podName) {
                return;
            }
            return {
                podPort: port.targetPort,
                podName,
            };
        };

        const fetchPodEndpointForSet = async (
            spec: K8sPortForwardSpec
        ): Promise<{ podName: string; podPort: number } | undefined> => {
            const kind = (
                {
                    deployment: "Deployment",
                    statefulset: "StatefulSet",
                } as Record<string, string>
            )[spec.remoteType];
            if (!kind) {
                return;
            }
            const object = await read({
                apiVersion: "apps/v1",
                kind,
                metadata: {
                    namespace: spec.namespace,
                    name: spec.remoteName,
                },
            });
            if (!object) {
                return;
            }
            const selector = (object as any).spec?.selector?.matchLabels;
            if (!selector) {
                return;
            }
            const podName = await fetchPodNameForLabelMap(selector);
            if (!podName) {
                return;
            }
            return {
                podPort: spec.remotePort,
                podName,
            };
        };

        const fetchPodEndpoint = async (
            spec: K8sPortForwardSpec
        ): Promise<{ podName: string; podPort: number } | undefined> => {
            switch (spec.remoteType) {
                case "pod":
                    return {
                        podName: spec.remoteName,
                        podPort: spec.remotePort,
                    };
                case "service":
                    return await fetchPodEndpointForService(spec);
                case "deployment":
                case "statefulset":
                    return await fetchPodEndpointForSet(spec);
                default:
                    throw new Error(
                        "Unsupported remoteType: " + spec.remoteType
                    );
            }
        };

        let numConnections = 0;
        let sumBytesDown = 0;
        let sumBytesUp = 0;
        let statsUpdateFunctions: Array<() => void> = [];
        let socketEndFunctions: Array<() => void> = [];

        const sendStats = () => {
            statsUpdateFunctions.forEach((f) => {
                f();
            });
            portForwardStats[id] = {
                timestampMs: new Date().getTime(),
                sumBytesDown,
                sumBytesUp,
                numConnections,
            };
            sendPortForwardStats();
        };

        const statsInterval = setInterval(() => {
            sendStats();
        }, 200);

        const portForward = new PortForward(kubeConfig);
        const server = net.createServer(async (socket) => {
            const downstreamStats = streamStats();
            const upstreamStats = streamStats();

            const downstream = new PassThrough();
            const upstream = new PassThrough();
            pipeline(downstream, downstreamStats, socket, (err) => {
                if (err) {
                    console.error("Downstream error", err);
                    portForwardWatchers.forEach(({ onError }) =>
                        onError(err, id)
                    );
                }
            });
            pipeline(socket, upstreamStats, upstream, (err) => {
                if (err) {
                    console.error("Upstream error", err);
                    portForwardWatchers.forEach(({ onError }) =>
                        onError(err, id)
                    );
                }
            });

            let prevDownstreamBytes = 0;
            let prevUpstreamBytes = 0;
            const statsUpdateFunction = () => {
                const downstreamBytes = downstreamStats.stats().sumWritten;
                sumBytesDown += downstreamBytes - prevDownstreamBytes;
                prevDownstreamBytes = downstreamBytes;

                const upstreamBytes = upstreamStats.stats().sumWritten;
                sumBytesUp += upstreamBytes - prevUpstreamBytes;
                prevUpstreamBytes = upstreamBytes;
            };
            statsUpdateFunctions.push(statsUpdateFunction);

            const socketEndFunction = () => {
                socket.destroy();
            };
            socketEndFunctions.push(socketEndFunction);

            socket.on("error", (err) => {
                console.error("Socket error", err);
                portForwardWatchers.forEach(({ onError }) => onError(err, id));
            });
            socket.on("close", () => {
                numConnections--;
                sendStats();
                statsUpdateFunctions = statsUpdateFunctions.filter(
                    (f) => f !== statsUpdateFunction
                );
                socketEndFunctions = socketEndFunctions.filter(
                    (f) => f !== socketEndFunction
                );
            });
            try {
                const podEndpoint = await fetchPodEndpoint(spec);
                if (!podEndpoint) {
                    throw new Error("No pod endpoint found for port forward");
                }
                const { podName, podPort } = podEndpoint;
                await portForward.portForward(
                    spec.namespace,
                    podName,
                    [podPort],
                    downstream,
                    null,
                    upstream
                );
            } catch (e) {
                console.error("Error initializing port forward", e);
                socket.destroy();
                return;
            }
            numConnections++;
            sendStats();
        });

        let rejectPromise: ((reason?: any) => void) | undefined;

        server.on("error", (err) => {
            console.error("portForward server error", err);
            if (rejectPromise) {
                // The error occurred while starting the listening process.
                rejectPromise(err);
                return;
            }
            portForwardWatchers.forEach(({ onError }) => onError(err, id));
            server.close();
        });
        server.on("close", () => {
            delete portForwardStats[id];
            delete portForwardHandles[id];
            portForwardWatchers.forEach(({ onStop }) =>
                onStop(entry as K8sPortForwardEntry)
            );
            portForwards = portForwards.filter((e) => e !== entry);
            portForwardWatchers.forEach(({ onChange }) =>
                onChange(portForwards)
            );
            clearInterval(statsInterval);
        });

        const localPort = spec?.localPort ?? (await getPort());
        return new Promise((resolve, reject) => {
            rejectPromise = reject;
            server.listen(
                localPort,
                spec?.localOnly ?? true ? "localhost" : undefined,
                () => {
                    const address = server.address();
                    entry.localAddress =
                        typeof address === "string" ? address : address.address;
                    entry.localPort = localPort;
                    portForwards.push(entry as K8sPortForwardEntry);
                    portForwardStats[id] = {
                        timestampMs: new Date().getTime(),
                        sumBytesDown: 0,
                        sumBytesUp: 0,
                        numConnections: 0,
                    };
                    portForwardWatchers.forEach(({ onStart }) =>
                        onStart(entry as K8sPortForwardEntry)
                    );
                    portForwardWatchers.forEach(({ onChange }) =>
                        onChange(portForwards)
                    );
                    portForwardHandles[id] = {
                        stop() {
                            socketEndFunctions?.forEach((f) => f());
                            server.close();
                        },
                    };
                    rejectPromise = undefined;
                    resolve(entry as K8sPortForwardEntry);
                }
            );
        });
    };

    const stopPortForward = async (id: string): Promise<void> => {
        portForwardHandles[id]?.stop();
    };

    const getVersion = async (): Promise<K8sVersion> => {
        const {
            body: { major, minor, platform },
        } = await versionApi.getCode();
        return {
            major,
            minor,
            platform,
        };
    };

    const getKubeConfig = () => kubeConfig;

    return {
        read,
        apply,
        patch,
        replace,
        redeploy,
        remove,
        exec,
        execCommand,
        list,
        listWatch,
        log,
        logWatch,
        listPortForwards,
        watchPortForwards,
        portForward,
        stopPortForward,
        retryConnections,
        listApiResourceTypes,
        getKubeConfig,
        getVersion,
    };
}
