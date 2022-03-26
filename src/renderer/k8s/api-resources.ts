import { useEffect, useState } from "react";
import { K8sResourceTypeInfo } from "../../common/k8s/client";
import { useK8sClient } from "./client";
import { useK8sListWatch } from "./list-watch";

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
    const client = useK8sClient();

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
                setValue([false, resources, undefined]);
            } catch (e) {
                setValue([false, undefined, e]);
            }
        })();
    }, [isLoadingCrds, crds, setValue]);

    return value;
}
