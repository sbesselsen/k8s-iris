import * as k8s from "@kubernetes/client-node";
import * as request from "request";
import { kubeRequestOpts } from "./util";

export type K8sApi = {
    group?: string;
    version: string;
    apiVersion: string;
};

export type K8sApiResource = {
    api: K8sApi;
    name: string;
    namespaced: boolean;
    isSubResource: boolean;
    kind: string;
    misc: Record<string, any>;
    verbs?: string[] | undefined;
};

export async function fetchApiList(
    kubeConfig: k8s.KubeConfig
): Promise<Array<K8sApi>> {
    const opts = await kubeRequestOpts(kubeConfig);

    return new Promise((resolve, reject) => {
        const currentCluster = kubeConfig.getCurrentCluster();
        if (!currentCluster) {
            reject(new Error("No cluster selected"));
            return;
        }
        request.get(currentCluster.server, opts, (err, res, body) => {
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
                    const apis: K8sApi[] = [
                        {
                            version: "v1",
                            apiVersion: "v1",
                        },
                    ];
                    for (const path of data.paths) {
                        const match = path.match(/\/apis\/([^/]+)\/([^/]+)/);
                        if (match) {
                            apis.push({
                                group: match[1],
                                version: match[2],
                                apiVersion: `${match[1]}/${match[2]}`,
                            });
                        }
                    }
                    resolve(apis);
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}

export async function fetchApiIndex(
    kubeConfig: k8s.KubeConfig
): Promise<Record<string, K8sApi>> {
    return Object.fromEntries(
        (await fetchApiList(kubeConfig)).map((api) => [api.apiVersion, api])
    );
}

export async function fetchApiResourceList(
    kubeConfig: k8s.KubeConfig,
    api: K8sApi
): Promise<Array<K8sApiResource>> {
    const opts = await kubeRequestOpts(kubeConfig);

    return new Promise((resolve, reject) => {
        const pathParts = [];
        if (api.group) {
            pathParts.push("apis");
            pathParts.push(api.group);
        } else {
            pathParts.push("api");
        }
        pathParts.push(api.version);
        const path = pathParts.join("/");

        const currentCluster = kubeConfig.getCurrentCluster();
        if (!currentCluster) {
            reject(new Error("No cluster selected"));
            return;
        }

        request.get(
            `${currentCluster.server}/${path}`,
            opts,
            (err, res, body) => {
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
                        const resources: K8sApiResource[] = data.resources.map(
                            (resource: any) => ({
                                api,
                                name: resource.name,
                                namespaced: resource.namespaced,
                                isSubResource:
                                    resource.name.indexOf("/") !== -1,
                                kind: resource.kind,
                                misc: resource,
                                ...(resource.verbs
                                    ? { verbs: resource.verbs }
                                    : {}),
                            })
                        );
                        resolve(resources);
                    } catch (e) {
                        if (String(body).match(/service\s+unavailable/i)) {
                            // Looks like the handler may be turned off.
                            resolve([]);
                        }
                        reject(e);
                    }
                }
            }
        );
    });
}

export async function fetchApiResourceIndex(
    kubeConfig: k8s.KubeConfig,
    api: K8sApi
): Promise<Record<string, K8sApiResource>> {
    return Object.fromEntries(
        (await fetchApiResourceList(kubeConfig, api)).map((resource) => [
            resource.name,
            resource,
        ])
    );
}
