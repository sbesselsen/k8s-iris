import * as k8s from "@kubernetes/client-node";
import { KubernetesObject } from "@kubernetes/client-node";
import * as request from "request";

import { sleep } from "../../common/util/async";

import {
    K8sClient,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListWatch,
    K8sObjectListWatcher,
    K8sObjectListWatcherMessage,
    K8sRemoveOptions,
    K8sRemoveStatus,
} from "../../common/k8s/client";
import { fetchApiResourceList, K8sApi, K8sApiResource } from "./meta";
import {
    addListObject,
    deleteListObject,
    updateListObject,
} from "../../common/k8s/util";
import { deepEqual } from "../../common/util/deep-equal";
import { kubeRequestOpts } from "./util";

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
};

const defaultClientOptions = {
    readonly: false,
};

export function createClient(
    kubeConfig: k8s.KubeConfig,
    options?: K8sClientOptions
): K8sBackendClient {
    const opts = {
        ...defaultClientOptions,
        ...options,
    };

    // TEMPORARY SAFETY MEASURE
    // TODO: REMOVE
    if (kubeConfig.getCurrentContext() !== "colima") {
        opts.readonly = true;
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

    const exists = async (spec: K8sObject): Promise<boolean> => {
        try {
            await objectApi.read(spec);
            return true;
        } catch (e) {}
        return false;
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

    const apply = async (spec: K8sObject): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }
        if (await exists(spec)) {
            return patch(spec);
        }
        const { body } = await objectApi.create(spec);
        return onlyFullObject(body);
    };

    const patch = async (spec: K8sObject): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }
        const { body } = await objectApi.patch(spec);
        return onlyFullObject(body);
    };

    const replace = async (spec: K8sObject): Promise<K8sObject> => {
        if (opts.readonly) {
            throw new Error("Running in readonly mode");
        }
        const { body } = await objectApi.replace(spec);
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
        if (spec.namespace) {
            if (!resourceInfo.namespaced) {
                throw new Error(
                    `Resource ${spec.apiVersion}.${spec.kind} is not namespaced`
                );
            }
            pathParts.push("namespaces");
            pathParts.push(encodeURIComponent(spec.namespace));
        }
        pathParts.push(encodeURIComponent(resourceInfo.name));

        const path = pathParts.join("/");

        return path;
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

                const timeout = setTimeout(() => {
                    retryConnectionsListeners =
                        retryConnectionsListeners.filter(
                            (l) => l !== retryConnectionsListener
                        );
                    resolve();
                }, 5000);

                retryConnectionsListener = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                retryConnectionsListeners.push(retryConnectionsListener);
            });
        };

        (async () => {
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
                                    list.items = data.items;
                                    watcher(undefined, { list: data });
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
                const newList = addListObject(list, obj);
                if (list === newList) {
                    // No rerender needed.
                    return;
                }
                watcher(undefined, {
                    list: newList,
                    update: {
                        type: "add",
                        object: obj as any,
                    },
                });
            });
            informer.on("update", (obj: any) => {
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
                console.error(err);
                // TODO: make this configurable or handlable somehow?
                // Restart informer after 5sec.
                retrySignal().then(() => {
                    informer.start();
                });
            });

            console.log(
                "Starting listwatch",
                kubeConfig.getCurrentContext(),
                spec.kind
            );
            informer.start();
        })().catch((e) => {
            // Send error to listener.
            watcher(e);
        });

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
        const key = `${spec.apiVersion}::${spec.kind}::${spec.namespace ?? ""}`;

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
                    // This was the last watcher. Stop watching and remove the reusable handle.
                    reusableHandle.stop();
                    reusableListWatchHandles[key] = reusableListWatchHandles[
                        key
                    ].filter((handle) => handle !== reusableHandle);
                }
            },
        };
    };

    return {
        read,
        apply,
        patch,
        replace,
        remove,
        list,
        listWatch,
        retryConnections,
    };
}
