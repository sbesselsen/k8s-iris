import { useEffect, useRef, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
} from "../../common/k8s/client";
import { useK8sClient } from "./client";

export type K8sListWatchHookOptions<T extends K8sObject = K8sObject> = {
    kubeContext?: string;
    onUpdate?: (list: K8sObjectList<T>, update: K8sObjectListUpdate<T>) => void;
};

const loadingValue: [boolean, undefined, undefined] = [
    true,
    undefined,
    undefined,
];

export function useK8sListWatch<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    deps: any[],
    options?: K8sListWatchHookOptions
): [boolean, K8sObjectList<T> | undefined, any | undefined] {
    const [value, setValue] =
        useState<[boolean, K8sObjectList<T> | undefined, any | undefined]>(
            loadingValue
        );

    const client = useK8sClient(options?.kubeContext);
    const listWatchRef = useRef<K8sObjectListWatch | undefined>();
    const listWatchId = useRef(0);

    useEffect(() => {
        const myListWatchId = ++listWatchId.current;
        setValue(loadingValue);
        (async () => {
            try {
                const listWatch = await client.listWatch<T>(
                    spec,
                    (list, update) => {
                        setValue([false, list, undefined]);
                        options?.onUpdate?.(list, update);
                    }
                );
                if (myListWatchId !== listWatchId.current) {
                    // This request is already expired.
                    listWatch.stop();
                    return;
                }

                listWatchRef.current = listWatch;
            } catch (e) {
                if (myListWatchId !== listWatchId.current) {
                    // This request is already expired.
                    return;
                }
                setValue([false, undefined, e]);
            }
        })();
        return () => {
            listWatchRef.current?.stop();
        };
    }, [client, setValue, ...deps]);

    const [_loading, _list, error] = value;

    if (error) {
        console.error("useK8sListWatch error:", error);
    }

    return value;
}
