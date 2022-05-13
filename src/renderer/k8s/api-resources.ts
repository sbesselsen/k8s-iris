import { useEffect, useState } from "react";
import { K8sResourceTypeInfo } from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { create } from "../util/state";
import { useK8sClient } from "./client";
import { useK8sListWatch } from "./list-watch";

const { useStore: useCacheStore } = create(
    {} as Record<string, K8sResourceTypeInfo[]>
);

const loadingValue: [boolean, undefined, undefined] = [
    true,
    undefined,
    undefined,
];

export function useK8sApiResourceTypes(): [
    boolean,
    K8sResourceTypeInfo[] | undefined,
    any | undefined
] {
    const context = useK8sContext();
    const client = useK8sClient();
    const cache = useCacheStore();

    // Watch CRDs so that we automatically rerender when a new CRD gets added.
    const [isLoadingCrds, crds, _crdsError] = useK8sListWatch(
        {
            apiVersion: "apiextensions.k8s.io/v1",
            kind: "CustomResourceDefinition",
        },
        {},
        []
    );

    const [value, setValue] =
        useState<[boolean, K8sResourceTypeInfo[] | undefined, any | undefined]>(
            loadingValue
        );

    useEffect(() => {
        (async () => {
            try {
                const resources = await client.listApiResourceTypes();
                cache.set((values) => ({ ...values, [context]: resources }));
                setValue([false, resources, undefined]);
            } catch (e) {
                setValue([false, undefined, e]);
            }
        })();
    }, [cache, client, context, isLoadingCrds, crds, setValue]);

    const cacheValues = context ? cache.get()[context] ?? null : null;
    if (cacheValues) {
        return [false, cacheValues, undefined];
    }

    return value;
}
