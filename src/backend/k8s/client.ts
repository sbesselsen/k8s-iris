import * as k8s from "@kubernetes/client-node";
import { KubernetesObject } from "@kubernetes/client-node";
import * as request from "request";

import {
    K8sClient,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
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

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
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
    const list = async <T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery
    ): Promise<K8sObjectList<T>> => {
        const resourceInfo = await listableResourceInfo(spec);
        if (resourceInfo === null) {
            throw new Error(
                `Resource ${spec.apiVersion}.${spec.kind} is not listable`
            );
        }

        return new Promise((resolve, reject) => {
            const opts: any = {};
            kubeConfig.applyToRequest(opts);

            const urlParts = [
                kubeConfig.getCurrentCluster().server,
                resourceInfo.api.apiVersion === "v1" ? "api" : "apis",
                resourceInfo.api.apiVersion,
            ];
            if (spec.namespace) {
                if (!resourceInfo.namespaced) {
                    throw new Error(
                        `Resource ${spec.apiVersion}.${spec.kind} is not namespaced`
                    );
                }
                urlParts.push("namespaces");
                urlParts.push(encodeURIComponent(spec.namespace));
            }
            urlParts.push(encodeURIComponent(resourceInfo.name));

            const url = urlParts.join("/");

            request.get(url, opts, (err, _res, body) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        const data = JSON.parse(body);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    };

    return {
        read,
        apply,
        patch,
        replace,
        remove,
        list,
    };
}
