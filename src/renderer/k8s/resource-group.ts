import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isSetLike, toK8sObjectIdentifierString } from "../../common/k8s/util";
import { Grouping, PostGrouping } from "../../common/util/group";

export type ResourceGroup = {
    id: string;
    title: string;
    titleQualifier?: string;
    sortOrder?: number;
    shouldDefaultExpand?: boolean;
};

export const helmGroup: Grouping<K8sObject, ResourceGroup> = (resource) => {
    let instanceName: string | undefined;
    let instanceNamespace: string | undefined;
    if (
        resource.metadata.annotations?.["meta.helm.sh/release-name"] &&
        resource.metadata.annotations?.["meta.helm.sh/release-namespace"]
    ) {
        instanceName =
            resource.metadata.annotations["meta.helm.sh/release-name"];
        instanceNamespace =
            resource.metadata.annotations["meta.helm.sh/release-namespace"];
    } else if (
        resource.metadata.annotations?.[
            "objectset.rio.cattle.io/owner-namespace"
        ] &&
        resource.metadata.annotations?.["objectset.rio.cattle.io/owner-name"]
    ) {
        instanceName =
            resource.metadata.annotations["objectset.rio.cattle.io/owner-name"];
        instanceNamespace =
            resource.metadata.annotations[
                "objectset.rio.cattle.io/owner-namespace"
            ];
    } else if (resource.metadata.annotations?.["app.kubernetes.io/instance"]) {
        instanceName =
            resource.metadata.annotations["app.kubernetes.io/instance"];
    }

    if (!instanceName) {
        return undefined;
    }
    const id = `helm:${instanceNamespace ?? ""}:${instanceName}`;
    const title = instanceName;
    return {
        id,
        title,
        titleQualifier: instanceNamespace,
        sortOrder: 0,
        shouldDefaultExpand: true,
    };
};

export const basicGroup: Grouping<K8sObject, ResourceGroup> = (resource) => {
    if (
        resource.metadata.annotations?.[
            "kubernetes.io/service-account.name"
        ] === "default" ||
        resource.metadata.name === "kube-root-ca.crt" ||
        !!resource.metadata.annotations?.[
            "kubernetes.io/service-account.name"
        ] ||
        !!resource.metadata.name.match(/^sh\.helm\.release\./)
    ) {
        return {
            id: "basic:internals",
            title: "Internals",
            sortOrder: 102,
            shouldDefaultExpand: false,
        };
    }
};

export const basicPostGroup: PostGrouping<K8sObject> = (resource) => {
    function returnTrue(): true {
        return true;
    }
    function acceptByIdentifiers(
        identifiers: Array<K8sObject | K8sObjectIdentifier>
    ): Record<string, (obj: K8sObject) => boolean> {
        return Object.fromEntries(
            identifiers
                .map(toK8sObjectIdentifierString)
                .map((id) => [id, returnTrue])
        );
    }

    if (
        resource.apiVersion === "networking.k8s.io/v1" &&
        resource.kind === "Ingress"
    ) {
        // Attach our TLS secrets.
        const secretNames: string[] = ((resource as any).spec?.tls ?? []).map(
            (item: any) => item.secretName
        );
        return {
            accept: acceptByIdentifiers(
                secretNames.map((name) => ({
                    apiVersion: "v1",
                    kind: "Secret",
                    name,
                    namespace: resource.metadata.namespace,
                }))
            ),
        };
    }
    if (isSetLike(resource)) {
        // Hook up our connected configMaps.
        const podSpec = (resource as any).spec?.template?.spec;
        const identifiers: Array<K8sObjectIdentifier | K8sObject> = [];
        const customAccepters: Record<string, (obj: K8sObject) => boolean> = {};
        if (podSpec) {
            for (const volume of podSpec.volumes ?? []) {
                if (volume.configMap) {
                    identifiers.push({
                        apiVersion: "v1",
                        kind: "ConfigMap",
                        name: volume.configMap.name,
                        namespace: resource.metadata.namespace,
                    });
                } else if (volume.secret) {
                    identifiers.push({
                        apiVersion: "v1",
                        kind: "Secret",
                        name: volume.secret.secretName,
                        namespace: resource.metadata.namespace,
                    });
                } else if (volume.persistentVolumeClaim) {
                    identifiers.push({
                        apiVersion: "v1",
                        kind: "PersistentVolumeClaim",
                        name: volume.persistentVolumeClaim.claimName,
                        namespace: resource.metadata.namespace,
                    });
                }
            }
            for (const container of podSpec.containers ?? []) {
                for (const envFrom of container.envFrom ?? []) {
                    if (envFrom.configMapRef) {
                        identifiers.push({
                            apiVersion: "v1",
                            kind: "ConfigMap",
                            name: envFrom.configMapRef.name,
                            namespace: resource.metadata.namespace,
                        });
                    }
                }
                for (const env of container.env ?? []) {
                    if (env.valueFrom) {
                        if (env.valueFrom.secretKeyRef) {
                            identifiers.push({
                                apiVersion: "v1",
                                kind: "Secret",
                                name: env.valueFrom.secretKeyRef.name,
                                namespace: resource.metadata.namespace,
                            });
                        }
                        if (env.valueFrom.configMapKeyRef) {
                            identifiers.push({
                                apiVersion: "v1",
                                kind: "ConfigMap",
                                name: env.valueFrom.configMapKeyRef.name,
                                namespace: resource.metadata.namespace,
                            });
                        }
                    }
                }
            }
        }
        for (const volumeClaimTemplate of (resource as any).spec
            ?.volumeClaimTemplates ?? []) {
            const labels = volumeClaimTemplate.metadata?.labels ?? {};
            const accept = (obj: K8sObject) => {
                return (
                    obj.apiVersion === "v1" &&
                    obj.kind === "PersistentVolumeClaim" &&
                    Object.entries(labels).every(
                        ([k, v]) => obj.metadata.labels?.[k] === v
                    )
                );
            };
            for (const [k, v] of Object.entries(labels)) {
                customAccepters[`pvc:${k}=${v}`] = accept;
            }
        }
        return {
            accept: { ...customAccepters, ...acceptByIdentifiers(identifiers) },
        };
    }

    const seek = [toK8sObjectIdentifierString(resource)];
    if (
        resource.apiVersion === "v1" &&
        resource.kind === "PersistentVolumeClaim"
    ) {
        // Try to hook up to our volumeTemplate.
        seek.push(
            ...Object.entries(resource.metadata.labels ?? {}).map(
                ([k, v]) => `pvc:${k}=${v}`
            )
        );
    }
    return {
        seek,
    };
};
