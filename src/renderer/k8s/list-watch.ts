import { useCallback, useEffect, useRef, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListWatch,
    K8sObjectListWatcherMessage,
} from "../../common/k8s/client";
import { useK8sClient } from "./client";

const loadingValue: [boolean, undefined, undefined] = [
    true,
    undefined,
    undefined,
];

export type K8sListWatchOptions = {
    kubeContext?: string;
};

export function useK8sListWatch<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    deps: any[] = []
): [boolean, K8sObjectList<T> | undefined, any | undefined] {
    const [value, setValue] =
        useState<[boolean, K8sObjectList<T> | undefined, any | undefined]>(
            loadingValue
        );

    const onUpdate = useCallback(
        (message: K8sObjectListWatcherMessage<K8sObject>) => {
            setValue([false, message.list as any, undefined]);
        },
        [setValue]
    );

    const onWatchError = useCallback(
        (error: any) => {
            setValue([false, undefined, error]);
        },
        [setValue]
    );

    useK8sListWatchListener(
        spec,
        {
            onUpdate,
            onWatchError,
        },
        deps
    );

    return value;
}

export type K8sListWatchListenerOptions<T extends K8sObject = K8sObject> =
    K8sListWatchOptions & {
        onUpdate: (message: K8sObjectListWatcherMessage<T>) => void;
        onWatchError: (error: any) => void;
    };

export function useK8sListWatchListener<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    options: K8sListWatchListenerOptions,
    deps: any[] = []
): void {
    const client = useK8sClient(options.kubeContext);
    const listWatchRef = useRef<K8sObjectListWatch | undefined>();

    const { onUpdate, onWatchError } = options;

    useEffect(() => {
        try {
            const listWatch = client.listWatch<T>(spec, (error, message) => {
                if (error) {
                    onWatchError(error);
                } else {
                    onUpdate(message);
                }
            });

            listWatchRef.current = listWatch;
        } catch (e) {
            onWatchError(e);
        }
        return () => {
            listWatchRef.current?.stop();
        };
    }, [client, listWatchRef, onUpdate, onWatchError, ...deps]);
}
