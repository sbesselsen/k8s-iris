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
    K8sRemoveOptions,
    K8sRemoveStatus,
} from "../../common/k8s/client";
import { fetchApiResourceList, K8sApi, K8sApiResource } from "./meta";

const defaultRemoveOptions: K8sRemoveOptions = {
    waitForCompletion: true,
};

function isFullObject(body: KubernetesObject): body is K8sObject {
    return !!body && !!body.apiVersion && !!body.kind && !!body.metadata;
}

function onlyFullObject(body: KubernetesObject): K8sObject | null {
    return isFullObject(body) ? body : null;
}

export type K8sClientOptions = {
    readonly?: boolean;
};

const defaultClientOptions = {
    readonly: false,
};

export function createClient(
    kubeConfig: k8s.KubeConfig,
    options?: K8sClientOptions
): K8sClient {
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

        const opts: any = {};
        await kubeConfig.applyToRequest(opts);

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

    const listWatch = async <T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ): Promise<K8sObjectListWatch> => {
        const path = await listPath(spec);

        let list: K8sObjectList<T> = {
            apiVersion: spec.apiVersion,
            kind: spec.kind,
            items: [],
        };

        const opts: any = {};
        await kubeConfig.applyToRequest(opts);

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
                                watcher(data);
                                resolve({ response, body: data });
                            } catch (e) {
                                reject(e);
                            }
                        }
                    }
                );
            });
        };

        const informer = k8s.makeInformer(
            kubeConfig,
            `/${path}`,
            listFn as any
        );

        const objSameRef = (obj1: K8sObject, obj2: K8sObject): boolean => {
            if (!obj1) {
                return !obj2;
            }
            return (
                obj1.apiVersion === obj2.apiVersion &&
                obj1.kind === obj2.kind &&
                obj1.metadata.name === obj2.metadata.name &&
                obj1.metadata.namespace === obj2.metadata.namespace
            );
        };

        informer.on("add", (obj: any) => {
            if (list.items.findIndex((item) => objSameRef(item, obj)) !== -1) {
                // The item is already in the list.
                return;
            }
            list = { ...list, items: [...list.items, obj] };
            watcher(list, {
                type: "add",
                object: obj as any,
            });
        });
        informer.on("update", (obj: any) => {
            list = {
                ...list,
                items: list.items.map((item) =>
                    objSameRef(item, obj) ? obj : item
                ),
            };
            watcher(list, {
                type: "update",
                object: obj,
            });
        });
        informer.on("delete", (obj: any) => {
            list = {
                ...list,
                items: list.items.filter((item) => !objSameRef(item, obj)),
            };
            watcher(list, {
                type: "remove",
                object: obj,
            });
        });
        informer.on("error", (err: KubernetesObject) => {
            console.error(err);
            // TODO: make this configurable or handlable somehow?
            // Restart informer after 5sec.
            setTimeout(() => {
                informer.start();
            }, 5000);
        });

        informer.start();

        return {
            stop() {
                informer.stop();
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
    };
}
