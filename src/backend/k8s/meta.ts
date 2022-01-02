import * as k8s from "@kubernetes/client-node";
import * as request from "request";

export type K8sApi = {
    group?: string;
    version: string;
    apiVersion: string;
};

export type K8sApiResource = {
    api: K8sApi;
    name: string;
    namespaced: boolean;
    kind: string;
    misc: Record<string, any>;
};

export async function fetchApiList(
    kubeConfig: k8s.KubeConfig
): Promise<Array<K8sApi>> {
    const opts: any = {};
    await kubeConfig.applyToRequest(opts);

    return new Promise((resolve, reject) => {
        request.get(
            kubeConfig.getCurrentCluster().server,
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
                        const apis: K8sApi[] = [
                            {
                                version: "v1",
                                apiVersion: "v1",
                            },
                        ];
                        for (const path of data.paths) {
                            const match = path.match(
                                /\/apis\/([^\/]+)\/([^\/]+)/
                            );
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
            }
        );
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
    const opts: any = {};
    await kubeConfig.applyToRequest(opts);

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

        request.get(
            `${kubeConfig.getCurrentCluster().server}/${path}`,
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
                            (resource) => ({
                                api,
                                name: resource.name,
                                namespaced: resource.namespaced,
                                kind: resource.kind,
                                misc: resource,
                            })
                        );
                        resolve(resources);
                    } catch (e) {
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
