import { useMemo } from "react";
import { K8sObject, K8sObjectListQuery } from "../../common/k8s/client";
import { K8sListWatchHookOptions, useK8sListWatch } from "./list-watch";

export type K8sAssociatedPodsResult = {
    hasAssociatedPods: boolean;
    isLoadingAssociatedPods: boolean;
    associatedPods: K8sObject[];
    error?: any;
};

function isSetLike(object: K8sObject) {
    if (object.apiVersion === "apps/v1") {
        return (
            object.kind === "Deployment" ||
            object.kind === "StatefulSet" ||
            object.kind === "ReplicaSet" ||
            object.kind === "DaemonSet"
        );
    }
    return false;
}

// A spec that returns zero pods.
const emptyPodQuery: K8sObjectListQuery = {
    apiVersion: "v1",
    kind: "Pod",
    namespaces: ["iris-nonexistent-namespace"],
    labelSelector: [
        { name: "somefield", value: "value1" },
        { name: "somefield", value: "value2" },
    ],
};

export function useK8sAssociatedPods(
    object: K8sObject | null | undefined,
    options?: K8sListWatchHookOptions,
    deps?: any[]
): K8sAssociatedPodsResult {
    const kind = object?.kind;
    const apiVersion = object?.apiVersion;
    const name = object?.metadata.name;
    const namespace = object?.metadata.namespace;
    const hasAssociatedPods: boolean = useMemo(() => {
        if (!object) {
            return false;
        }
        if (apiVersion === "v1" && kind === "Service") {
            return !!(object as any)?.spec?.selector;
        }
        if (object && isSetLike(object)) {
            return true;
        }
        return false;
    }, [kind, apiVersion, name, namespace, ...(deps ?? [])]);

    const spec: K8sObjectListQuery = useMemo(() => {
        if (!object || !hasAssociatedPods) {
            // Return a spec that returns zero pods.
            return emptyPodQuery;
        }
        if (object.apiVersion === "v1" && object.kind === "Service") {
            // Service.
            const selector = (object as any)?.spec?.selector;
            if (!selector) {
                return emptyPodQuery;
            }
            return {
                apiVersion: "v1",
                kind: "Pod",
                ...(object?.metadata.namespace
                    ? { namespace: [object.metadata.namespace] }
                    : {}),
                labelSelector: Object.entries(selector).map(([k, v]) => ({
                    name: k,
                    value: v as string | string[],
                })),
            };
        }
        if (isSetLike(object)) {
            const selector = (object as any)?.spec?.selector?.matchLabels;
            if (!selector) {
                return emptyPodQuery;
            }
            return {
                apiVersion: "v1",
                kind: "Pod",
                ...(object?.metadata.namespace
                    ? { namespace: [object.metadata.namespace] }
                    : {}),
                labelSelector: Object.entries(selector).map(([k, v]) => ({
                    name: k,
                    value: v as string | string[],
                })),
            };
        }
        return emptyPodQuery;
    }, [kind, apiVersion, name, namespace, hasAssociatedPods, ...(deps ?? [])]);

    const [isLoading, resources, resourceError] = useK8sListWatch(
        spec,
        options ?? {},
        [spec, ...(deps ?? [])]
    );

    return {
        hasAssociatedPods,
        isLoadingAssociatedPods: hasAssociatedPods && isLoading,
        associatedPods: hasAssociatedPods ? resources?.items ?? [] : [],
        ...(hasAssociatedPods && resourceError ? { error: resourceError } : {}),
    };
}
