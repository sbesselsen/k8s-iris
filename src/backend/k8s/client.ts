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
    objSameVersion,
    toK8sObjectIdentifierString,
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
            const { body } = await objectApi.read(spec as any);
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
                    if (!process.stdin) {
                        reject(new Error("kubectl apply: no stdin"));
                        return;
                    }
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
                    process.stdin?.end();
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

    const listWatchCounters = debugCounters(
        `listWatch:${kubeConfig.getCurrentContext()}:${clientIndex}`
    );

    /**
     * A listWatch that will return when started and that will stop working as soon as any kind of error occurs.
     */
    async function singleShotListWatch<T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ): Promise<K8sObjectListWatch> {
        let stopped = false;

        console.log(
            "singleShotListWatch: starting",
            spec.apiVersion,
            spec.kind
        );

        if (spec.namespaces && spec.namespaces.length === 0) {
            console.log(
                "singleShotListWatch: no namespaces provided, returning static empty list"
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

        // Fetch path and kube options.
        const path = await listPath(spec);
        const opts = await kubeRequestOpts(kubeConfig);

        if (path === null) {
            throw new Error(
                "Logic error: path not available when it should be"
            );
        }

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

        const passesNamespaceCheck = (obj: any) => {
            if (!spec.namespaces) {
                return true;
            }
            if (!obj?.metadata?.namespace) {
                return false;
            }
            return spec.namespaces.includes(obj.metadata.namespace);
        };

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
                                list.items
                                    .map(toK8sObjectIdentifierString)
                                    .forEach((key) => {
                                        loadedObjectKeys.add(key);
                                    });
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

        const loadedObjectKeys = new Set<string>();

        let list: K8sObjectList<T> = {
            apiVersion: spec.apiVersion,
            kind: spec.kind,
            items: [],
        };

        const addListener: k8s.ObjectCallback<T> = (obj) => {
            if (!passesNamespaceCheck(obj)) {
                return;
            }
            const key = toK8sObjectIdentifierString(obj);
            if (loadedObjectKeys.has(key)) {
                // No message needed.
                return;
            }
            loadedObjectKeys.add(key);

            list = addListObject(list, obj);
            watcher(undefined, {
                list,
                update: {
                    type: "add",
                    object: obj,
                },
            });
        };

        const deleteListener: k8s.ObjectCallback<T> = (obj) => {
            if (!passesNamespaceCheck(obj)) {
                return;
            }
            const key = toK8sObjectIdentifierString(obj);
            loadedObjectKeys.delete(key);

            list = deleteListObject(list, obj);
            watcher(undefined, {
                list,
                update: {
                    type: "remove",
                    object: obj,
                },
            });
        };

        const updateListener: k8s.ObjectCallback<T> = (obj) => {
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
        };

        const errorListener: k8s.ErrorCallback = (err) => {
            stopInformer();
            watcher(err);
        };

        let informer: k8s.Informer<T> | undefined = k8s.makeInformer(
            kubeConfig,
            `/${path}?` + querystring.stringify(queryParams),
            listFn,
            labelSelectorString
        );
        informer.on("add", addListener);
        informer.on("delete", deleteListener);
        informer.on("update", updateListener);
        informer.on("error", errorListener);

        await informer.start();
        listWatchCounters.up(
            `${spec.apiVersion}:${spec.kind}:${(spec.namespaces ?? []).join(
                ","
            )}`
        );

        function stopInformer() {
            if (!informer) {
                return;
            }

            informer.stop();
            listWatchCounters.down(
                `${spec.apiVersion}:${spec.kind}:${(spec.namespaces ?? []).join(
                    ","
                )}`
            );

            informer.off("add", addListener);
            informer.off("delete", deleteListener);
            informer.off("update", updateListener);
            informer.off("error", errorListener);
            informer = undefined;
        }

        function stop() {
            console.log(
                "singleShotListWatch: stopping",
                spec.apiVersion,
                spec.kind
            );

            if (stopped) {
                console.warn(
                    "singleShotListWatch: stopping while already stopped"
                );
                return;
            }
            if (!informer) {
                return;
            }
            stopInformer();
            stopped = true;
        }

        return {
            stop,
        };
    }

    function syncListWatch<T extends K8sObject = K8sObject>(
        asyncListWatch: (
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => Promise<K8sObjectListWatch>
    ): (
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ) => K8sObjectListWatch {
        return (spec, watcher) => {
            let listWatch: K8sObjectListWatch | undefined;
            let stopped = false;

            async function start() {
                console.log(
                    "syncListWatch: starting",
                    spec.apiVersion,
                    spec.kind
                );

                try {
                    listWatch = await asyncListWatch(spec, watcher);
                    if (stopped) {
                        // listWatch was stopped while we were starting up! Stop it immediately.
                        listWatch.stop();
                        listWatch = undefined;
                    }
                } catch (e) {
                    // Startup error!
                    console.error("syncListWatch startup error:", e);
                    listWatch = undefined;
                    watcher(e);
                }
            }

            start();

            return {
                stop() {
                    console.log(
                        "syncListWatch: stopping",
                        spec.apiVersion,
                        spec.kind
                    );

                    if (stopped) {
                        console.warn(
                            "syncListWatch: stopping while already stopped"
                        );
                    }

                    stopped = true;
                    if (listWatch) {
                        listWatch.stop();
                        listWatch = undefined;
                    }
                },
            };
        };
    }

    function restartingListWatch<T extends K8sObject = K8sObject>(
        baseListWatch: (
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => K8sObjectListWatch,
        restartDelayMs: number
    ): (
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ) => K8sObjectListWatch {
        return (spec, watcher) => {
            let listWatch: K8sObjectListWatch | undefined;
            let stopped = false;

            function start() {
                console.log(
                    "restartingListWatch: starting",
                    spec.apiVersion,
                    spec.kind
                );

                if (stopped) {
                    throw new Error(
                        "Logic error in restartingListWatch: starting while already stopped"
                    );
                }

                if (listWatch) {
                    throw new Error(
                        "restartingListWatch: starting while already running"
                    );
                }

                try {
                    listWatch = baseListWatch(spec, (err, message) => {
                        if (message) {
                            watcher(undefined, message);
                        } else {
                            console.error(
                                "restartingListWatch error, scheduling restart:",
                                err
                            );
                            watcher(err);

                            listWatch?.stop();
                            listWatch = undefined;

                            // Try again after a delay!
                            setTimeout(() => {
                                if (!stopped) {
                                    start();
                                }
                            }, restartDelayMs);
                        }
                    });
                } catch (e) {
                    // Startup error!
                    console.error(
                        "restartingListWatch startup error, scheduling restart:",
                        e
                    );
                    watcher(e);

                    // Try again after a delay!
                    setTimeout(() => {
                        if (!stopped) {
                            start();
                        }
                    }, restartDelayMs);
                }
            }

            start();

            return {
                stop() {
                    console.log(
                        "restartingListWatch: stopping",
                        spec.apiVersion,
                        spec.kind
                    );

                    if (stopped) {
                        console.warn(
                            "restartingListWatch: stopping while already stopped"
                        );
                    }

                    stopped = true;
                    if (listWatch) {
                        listWatch.stop();
                        listWatch = undefined;
                    }
                },
            };
        };
    }

    function rebumpingListWatch<T extends K8sObject = K8sObject>(
        baseListWatch: (
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => K8sObjectListWatch,
        rebumpIntervalMs: number
    ): (
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ) => K8sObjectListWatch {
        return (spec, watcher) => {
            let didReceiveMessage = false;
            let listWatch: K8sObjectListWatch | undefined;
            let stopped = false;
            let rebumpInterval: any;

            function start() {
                console.log(
                    "rebumpingListWatch: starting",
                    spec.apiVersion,
                    spec.kind
                );

                if (stopped) {
                    throw new Error(
                        "Logic error in rebumpingListWatch: starting while already stopped"
                    );
                }

                if (listWatch) {
                    throw new Error(
                        "rebumpingListWatch: starting while already running"
                    );
                }

                listWatch = baseListWatch(spec, (err, message) => {
                    watcher(err, message);
                    didReceiveMessage = true;
                });
            }

            rebumpInterval = setInterval(() => {
                if (listWatch && !didReceiveMessage) {
                    // Restart!
                    console.log(
                        `rebumpingListWatch: have not received any updates in ${rebumpIntervalMs}ms, restarting`,
                        spec.apiVersion,
                        spec.kind
                    );

                    const currentListWatch = listWatch;
                    listWatch = undefined;
                    start();
                    currentListWatch.stop();
                }
                didReceiveMessage = false;
            }, rebumpIntervalMs);

            start();

            return {
                stop() {
                    console.log(
                        "rebumpingListWatch: stopping",
                        spec.apiVersion,
                        spec.kind
                    );

                    if (stopped) {
                        console.warn(
                            "rebumpingListWatch: stopping while already stopped"
                        );
                    }

                    stopped = true;
                    if (listWatch) {
                        listWatch.stop();
                        listWatch = undefined;
                    }

                    if (rebumpInterval) {
                        clearInterval(rebumpInterval);
                        rebumpInterval = undefined;
                    }
                },
            };
        };
    }

    function cachedObjectsListWatch<T extends K8sObject = K8sObject>(
        baseListWatch: (
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => K8sObjectListWatch
    ): (
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ) => K8sObjectListWatch {
        return (spec, watcher) => {
            let cachedObjects: Record<string, T> | undefined;
            let lastMessageWasError = false;

            return baseListWatch(spec, (err, message) => {
                if (message) {
                    if (!cachedObjects || message.update) {
                        // Pass the message through normally.
                        cachedObjects = Object.fromEntries(
                            message.list.items.map((obj) => [
                                toK8sObjectIdentifierString(obj),
                                obj,
                            ])
                        );
                        watcher(err, message);
                        lastMessageWasError = false;
                        return;
                    }

                    let didSendUpdates = false;

                    // This is a new initial list message.
                    // Check what is different to the list of items and pass the changes as individual messages.
                    const newObjects: Record<string, T> = {};
                    for (const obj of message.list.items) {
                        const key = toK8sObjectIdentifierString(obj);
                        newObjects[key] = obj;

                        if (!cachedObjects[key]) {
                            cachedObjects[key] = obj;
                            didSendUpdates = true;
                            watcher(undefined, {
                                list: message.list,
                                update: {
                                    type: "add",
                                    object: obj,
                                },
                            });
                        } else if (!objSameVersion(obj, cachedObjects[key])) {
                            cachedObjects[key] = obj;
                            didSendUpdates = true;
                            watcher(undefined, {
                                list: message.list,
                                update: {
                                    type: "update",
                                    object: obj,
                                },
                            });
                        }
                    }
                    for (const key of Object.keys(cachedObjects)) {
                        if (!newObjects[key]) {
                            const cachedObj = cachedObjects[key];
                            delete cachedObjects[key];
                            didSendUpdates = true;
                            watcher(undefined, {
                                list: message.list,
                                update: {
                                    type: "remove",
                                    object: cachedObj,
                                },
                            });
                        }
                    }

                    if (!didSendUpdates) {
                        // Send the full update anyway, to make sure the client knows that the error state is over.
                        if (lastMessageWasError) {
                            watcher(undefined, message);
                        } else {
                            console.log(
                                "cachedObjectsListWatch: suppressed full update"
                            );
                        }
                    }
                    lastMessageWasError = false;
                } else {
                    lastMessageWasError = true;
                    watcher(err);
                }
            });
        };
    }

    function reusableListWatch<T extends K8sObject = K8sObject>(
        baseListWatch: (
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => K8sObjectListWatch
    ): (
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ) => K8sObjectListWatch {
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

        return (spec, watcher) => {
            const key = `reusable:${spec.apiVersion}::${spec.kind}::${(
                spec.namespaces ?? []
            ).join(",")}`;

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
    }

    // function devErrorPeriodsListWatch<T extends K8sObject = K8sObject>(
    //     baseListWatch: (
    //         spec: K8sObjectListQuery,
    //         watcher: K8sObjectListWatcher<T>
    //     ) => K8sObjectListWatch,
    //     periodDurationMs: number
    // ): (
    //     spec: K8sObjectListQuery,
    //     watcher: K8sObjectListWatcher<T>
    // ) => K8sObjectListWatch {
    //     return (spec, watcher) => {
    //         let isInFakeErrorState = false;
    //         let lastMessage: K8sObjectListWatcherMessage<T> | undefined;

    //         const interval = setInterval(() => {
    //             isInFakeErrorState = !isInFakeErrorState;
    //             if (isInFakeErrorState) {
    //                 console.log(
    //                     "devErrorPeriodsListWatch: entering fake error state",
    //                     spec.apiVersion,
    //                     spec.kind
    //                 );
    //                 watcher(new Error("Fake error"));
    //             } else {
    //                 console.log(
    //                     "devErrorPeriodsListWatch: leaving fake error state",
    //                     spec.apiVersion,
    //                     spec.kind
    //                 );
    //                 if (lastMessage) {
    //                     watcher(undefined, { list: lastMessage.list });
    //                 }
    //             }
    //         }, periodDurationMs);
    //         const listWatch = baseListWatch(spec, (err, message) => {
    //             lastMessage = message;
    //             if (!isInFakeErrorState) {
    //                 watcher(err, message);
    //             }
    //         });
    //         return {
    //             stop() {
    //                 clearInterval(interval);
    //                 listWatch.stop();
    //             },
    //         };
    //     };
    // }

    // function countingListWatch<T extends K8sObject = K8sObject>(
    //     baseListWatch: (
    //         spec: K8sObjectListQuery,
    //         watcher: K8sObjectListWatcher<T>
    //     ) => K8sObjectListWatch,
    //     prefix: string
    // ): (
    //     spec: K8sObjectListQuery,
    //     watcher: K8sObjectListWatcher<T>
    // ) => K8sObjectListWatch {
    //     return (spec, watcher) => {
    //         listWatchCounters.up(
    //             `${prefix}:${spec.apiVersion}:${spec.kind}:${(
    //                 spec.namespaces ?? []
    //             ).join(",")}`
    //         );
    //         const listWatch = baseListWatch(spec, watcher);
    //         return {
    //             stop() {
    //                 listWatch.stop();
    //                 listWatchCounters.down(
    //                     `${prefix}:${spec.apiVersion}:${spec.kind}:${(
    //                         spec.namespaces ?? []
    //                     ).join(",")}`
    //                 );
    //             },
    //         };
    //     };
    // }

    // Create the core listwatch without any error handling.
    let listWatch = syncListWatch(singleShotListWatch);

    // Restart the listwatch after 2 seconds if it fails.
    listWatch = restartingListWatch(listWatch, 2000);

    // Rebump the listwatch after 60 seconds if nothing new happens.
    listWatch = rebumpingListWatch(listWatch, 60000);

    // Don't pass the entire list again after restarts or rebumps, only the updates.
    listWatch = cachedObjectsListWatch(listWatch);

    // Reuse the same listwatch where possible.
    listWatch = reusableListWatch(listWatch);

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
                        typeof address === "string"
                            ? address
                            : address?.address;
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
