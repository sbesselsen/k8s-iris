import * as k8s from "@kubernetes/client-node";
import { KubeConfig, KubernetesObject } from "@kubernetes/client-node";
import * as request from "request";
import { exec as execChildProcess } from "child_process";
import { Exec } from "@kubernetes/client-node";
import { PassThrough } from "stream";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { sleep } from "../../common/util/async";

import {
    K8sClient,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListWatch,
    K8sObjectListWatcher,
    K8sObjectListWatcherMessage,
    K8sApplyOptions,
    K8sPatchOptions,
    K8sRemoveOptions,
    K8sRemoveStatus,
    K8sExecSpec,
    K8sExecOptions,
    K8sExecHandler,
    K8sExecCommandSpec,
    K8sExecCommandOptions,
    K8sExecCommandStatus,
    K8sExecCommandResult,
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
import { kubeRequestOpts } from "./util";
import { CharmPatchedExecAuth } from "./authenticator/exec";
import { toYaml } from "../../common/util/yaml";
import { shellOptions } from "../util/shell";
import { bufferToArrayBuffer } from "../util/buffer";

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
};

export type K8sClientOptions = {
    readonly?: boolean;
    getTempDirPath?: () => string;
};

const defaultClientOptions = {
    readonly: false,
    getTempDirPath: () => "/tmp",
};

// Patch KubeConfig class with an ExecAuth class that works asynchronously.
((k8s.KubeConfig as any).authenticators as Array<any>).unshift(
    new CharmPatchedExecAuth()
);

export function createClient(
    kubeConfig: k8s.KubeConfig,
    options?: K8sClientOptions
): K8sBackendClient {
    const opts = {
        ...defaultClientOptions,
        ...options,
    };

    if (opts.readonly) {
        console.log(
            "Opening in readonly mode:",
            kubeConfig.getCurrentContext()
        );
    }

    const objectApi = kubeConfig.makeApiClient(k8s.KubernetesObjectApi);

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
        } catch (e) {}
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

    const apply = async (
        spec: K8sObject,
        options?: K8sApplyOptions
    ): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }

        return withTempKubeConfig(
            kubeConfig,
            (kubeConfigPath) =>
                new Promise((resolve, reject) => {
                    const shellOpts = shellOptions();
                    const process = execChildProcess(
                        `kubectl apply --kubeconfig=${kubeConfigPath} -f -`,
                        {
                            shell: shellOpts.executablePath,
                            env: shellOpts.env,
                        },
                        (err, _stdout, stderr) => {
                            if (err) {
                                reject(stderr);
                            } else {
                                resolve(read(spec));
                            }
                        }
                    );
                    const specClone: any = JSON.parse(JSON.stringify(spec));
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
        } catch (e) {
            if ("statusCode" in e && e.statusCode === 409) {
                // Conflict! See if the caller wants to force the patch.
                e.isConflictError = true;
                e.conflictData = (e as any).body;
            }
            throw e;
        }
        return onlyFullObject(body);
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
        return onlyFullObject(body);
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

        return new Promise((resolve, reject) => {
            request.get(
                `${kubeConfig.getCurrentCluster().server}/${path}`,
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

        const retrySignal = async () => {
            // Send a retry signal after a certain number of seconds, or when retryConnections is called; whichever comes first.
            return new Promise<void>((resolve) => {
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
            let path: string;
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

            let list: K8sObjectList<T> = {
                apiVersion: spec.apiVersion,
                kind: spec.kind,
                items: [],
            };

            const listFn = () => {
                return new Promise((resolve, reject) => {
                    request.get(
                        `${kubeConfig.getCurrentCluster().server}/${path}`,
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

            informer = k8s.makeInformer(kubeConfig, `/${path}`, listFn as any);

            informer.on("add", (obj: any) => {
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
                        object: obj as any,
                    },
                });
            });
            informer.on("update", (obj: any) => {
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
            informer.on("delete", (obj: any) => {
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
            informer.on("error", (err: KubernetesObject) => {
                if (stopped) {
                    return;
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

                    await informer.start();
                    console.log(
                        "Informer restarted",
                        kubeConfig.getCurrentContext(),
                        spec.kind
                    );
                    watcher(undefined, {
                        list,
                    });
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

        let reusableHandle = reusableListWatchHandles[key].find((handle) =>
            deepEqual(handle.spec, spec)
        );
        if (!reusableHandle) {
            // Create a reusable handle.
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
            reusableHandle = handle;
        }

        // Reuse the existing handle.
        const { watchers, lastMessage } = reusableHandle;
        if (lastMessage) {
            // Send the last received message to the watcher.
            const { error, message } = lastMessage;
            if (error) {
                watcher(error);
            } else {
                watcher(error, message as any);
            }
        }
        watchers.push(watcher as any);
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

    const exec = async (
        spec: K8sExecSpec,
        options?: K8sExecOptions
    ): Promise<K8sExecHandler> => {
        // TODO: set some high water marks?
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const stdin = new PassThrough();

        let socket: {
            close(): void;
        };

        let stdoutListener, stderrListener;
        let closeListener: (status?: K8sExecCommandStatus) => void;

        const handler: K8sExecHandler = {
            onStdout(listener) {
                if (stdoutListener && stdoutListener !== listener) {
                    throw new Error(
                        "Cannot call .onStdout() multiple times with different arguments"
                    );
                }
                stdoutListener = (chunk: string | Buffer) => {
                    listener(
                        bufferToArrayBuffer(
                            typeof chunk === "string"
                                ? Buffer.from(chunk, "utf8")
                                : chunk
                        )
                    );
                };
                stdout.on("data", stdoutListener);
            },
            onStderr(listener) {
                if (stderrListener && stderrListener !== listener) {
                    throw new Error(
                        "Cannot call .onStdout() multiple times with different arguments"
                    );
                }
                stderrListener = (chunk: string | Buffer) => {
                    listener(
                        bufferToArrayBuffer(
                            typeof chunk === "string"
                                ? Buffer.from(chunk, "utf8")
                                : chunk
                        )
                    );
                };
                stderr.on("data", stderrListener);
            },
            onError(listener) {
                // TODO: don't really know what to do here yet
            },
            onEnd(listener) {
                closeListener = listener;
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
        spec: K8sExecCommandSpec,
        options?: K8sExecCommandOptions
    ): Promise<K8sExecCommandResult> => {
        const handler = await exec({ ...spec, tty: false });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        handler.onStdout((chunk) => {
            // WHY DOES SCARY CERTIFICATE INFO ENTER MY BUFFER? What the hell is happening here?
            stdout.push(Buffer.from(chunk));
        });
        handler.onStderr((chunk) => {
            stderr.push(Buffer.from(chunk));
        });
        return new Promise((resolve) => {
            handler.onEnd((status) => {
                resolve({
                    status: {
                        status: status.status ?? "",
                        message: status.message ?? "",
                    },
                    stdout: bufferToArrayBuffer(Buffer.concat(stdout)),
                    stderr: bufferToArrayBuffer(Buffer.concat(stderr)),
                });
            });
        });
    };

    return {
        read,
        apply,
        patch,
        replace,
        remove,
        exec,
        execCommand,
        list,
        listWatch,
        retryConnections,
        listApiResourceTypes,
    };
}
