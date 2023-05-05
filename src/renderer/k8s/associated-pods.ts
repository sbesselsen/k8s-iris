import { useMemo } from "react";
import {
    K8sClient,
    K8sObject,
    K8sObjectListQuery,
} from "../../common/k8s/client";
import { isSetLike } from "../../common/k8s/util";
import { reuseShallowEqualObject } from "../../common/util/deep-equal";
import { k8sSmartCompare } from "../../common/util/sort";
import {
    ReadableStore,
    useDerivedReadableStore,
    useProvidedStoreValue,
} from "../util/state";
import {
    K8sListWatchHookOptions,
    K8sListWatchStoreValue,
    useK8sListWatchStore,
} from "./list-watch";

export type K8sAssociatedPodsResult = {
    hasAssociatedPods: boolean;
    isLoadingAssociatedPods: boolean;
    associatedPods: K8sObject[];
    error?: any;
};

export type K8sAssociatedPodsStoreValue = K8sListWatchStoreValue & {
    hasAssociatedPods: boolean;
};

export function useK8sAssociatedPods(
    object: K8sObject | null | undefined,
    options?: K8sListWatchHookOptions,
    deps?: any[]
): K8sAssociatedPodsResult {
    const store = useK8sAssociatedPodsStore(object, options, deps);
    return useProvidedStoreValue(store, (v) => ({
        hasAssociatedPods: v.hasAssociatedPods,
        isLoadingAssociatedPods: v.isLoading,
        associatedPods: [...v.identifiers]
            .map((key) => v.resources[key])
            .sort((r1, r2) =>
                k8sSmartCompare(r1.metadata.name, r2.metadata.name)
            ),
    }));
}

export function useK8sAssociatedPodsStore(
    object: K8sObject | null | undefined,
    options?: K8sListWatchHookOptions,
    deps?: any[]
): ReadableStore<K8sAssociatedPodsStoreValue> {
    const kind = object?.kind;
    const apiVersion = object?.apiVersion;
    const name = object?.metadata.name;
    const namespace = object?.metadata.namespace;
    const hasAssociatedPods: boolean = useMemo(() => {
        if (!object) {
            return false;
        }
        if (object.apiVersion === "v1" && object.kind === "Service") {
            return !!(object as any)?.spec?.selector;
        }
        if (isSetLike(object)) {
            return true;
        }
        return false;
    }, [object, ...(deps ?? [])]);

    // Memo by kind, apiVersion, name, namespace because changes to the object should not lead to new queries.
    // That would make for example the detail page of a deployment very jumpy if we change things to it.
    const specs: K8sObjectListQuery[] = useMemo(
        () => (object ? getAssociatedPodsQueries(object) : []),
        [kind, apiVersion, name, namespace, hasAssociatedPods, ...(deps ?? [])]
    );

    const store = useK8sListWatchStore(specs, options ?? {}, [specs]);

    return useDerivedReadableStore(
        store,
        (value, _prevValue, prevOutput) => {
            const output = { ...value, hasAssociatedPods };
            return reuseShallowEqualObject(output, prevOutput);
        },
        [hasAssociatedPods]
    );
}

function getAssociatedPodsQueries(object: K8sObject): K8sObjectListQuery[] {
    if (!object) {
        return [];
    }
    if (object.apiVersion === "v1" && object.kind === "Service") {
        // Service.
        const selector = (object as any)?.spec?.selector;
        if (!selector) {
            return [];
        }
        return [
            {
                apiVersion: "v1",
                kind: "Pod",
                ...(object?.metadata.namespace
                    ? { namespaces: [object.metadata.namespace] }
                    : {}),
                labelSelector: Object.entries(selector).map(([k, v]) => ({
                    name: k,
                    value: v as string | string[],
                })),
            },
        ];
    }
    if (isSetLike(object)) {
        const selector = (object as any)?.spec?.selector?.matchLabels;
        if (!selector) {
            return [];
        }
        return [
            {
                apiVersion: "v1",
                kind: "Pod",
                ...(object?.metadata.namespace
                    ? { namespaces: [object.metadata.namespace] }
                    : {}),
                labelSelector: Object.entries(selector).map(([k, v]) => ({
                    name: k,
                    value: v as string | string[],
                })),
            },
        ];
    }
    return [];
}

export async function fetchAssociatedPods(
    client: K8sClient,
    object: K8sObject
): Promise<K8sObject[]> {
    const results = await Promise.all(
        getAssociatedPodsQueries(object).map((q) => client.list(q))
    );
    return results.reduce((objects, result) => {
        objects.push(...result.items);
        return objects;
    }, [] as K8sObject[]);
}

export function createAssociatedPodsFilter(
    object: K8sObject
): (pod: K8sObject) => boolean {
    function createSelectorFilter(
        selector: Record<string, string | string[]> | undefined
    ): (pod: K8sObject) => boolean {
        if (!selector) {
            return () => false;
        }
        const selectorEntries = Object.entries(selector).map(
            ([k, v]) =>
                [k, new Set(Array.isArray(v) ? v : [v])] as [
                    string,
                    Set<string>
                ]
        );
        if (selectorEntries.length === 0) {
            return () => false;
        }
        return (pod) => {
            const labels = pod?.metadata?.labels;
            if (!labels) {
                return false;
            }
            return selectorEntries.every(
                ([label, values]) =>
                    label in labels && values.has(labels[label])
            );
        };
    }

    if (object.apiVersion === "v1" && object.kind === "Service") {
        return createSelectorFilter((object as any)?.spec?.selector);
    }
    if (isSetLike(object)) {
        return createSelectorFilter(
            (object as any)?.spec?.selector?.matchLabels
        );
    }
    return () => false;
}
