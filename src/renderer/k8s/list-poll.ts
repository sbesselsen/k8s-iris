import { useCallback, useEffect, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
} from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { useK8sClient } from "./client";

const loadingValue: [boolean, undefined, undefined] = [
    true,
    undefined,
    undefined,
];

export type K8sListPollOptions = {
    pollInterval: number;
};

export type K8sListPollHookOptions = K8sListPollOptions;
export type K8sListPollListenerOptions<T extends K8sObject = K8sObject> =
    K8sListPollOptions & {
        onUpdate: (list: K8sObjectList<T>) => void;
        onError: (error: any) => void;
    };

export function useK8sListPoll<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    opts: K8sListPollHookOptions,
    deps: any[] = []
): [boolean, K8sObjectList<T> | undefined, any | undefined] {
    const kubeContext = useK8sContext();

    const [value, setValue] =
        useState<[boolean, K8sObjectList<T> | undefined, any | undefined]>(
            loadingValue
        );

    useEffect(() => {
        setValue(loadingValue);
    }, [kubeContext, setValue]);

    const onUpdate = useCallback(
        (list: K8sObjectList<T>) => {
            setValue([false, list, undefined]);
        },
        [setValue]
    );

    const onError = useCallback(
        (error: any) => {
            setValue([false, undefined, error]);
        },
        [setValue]
    );

    useK8sListPollListener(
        spec,
        {
            ...opts,
            onUpdate,
            onError,
        },
        deps
    );

    return value;
}

const minPollInterval = 100;

export function useK8sListPollListener<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    options: K8sListPollListenerOptions<T>,
    deps: any[] = []
): void {
    const kubeContext = useK8sContext() ?? "";

    const client = useK8sClient(kubeContext);

    const { onUpdate, onError, pollInterval = 0 } = options;

    useEffect(() => {
        async function update() {
            try {
                const result = await client.list(spec);
                onUpdate(result as K8sObjectList<T>);
            } catch (e) {
                onError(e);
            }
        }

        update();

        const interval = setInterval(() => {
            update();
        }, Math.max(pollInterval, minPollInterval));

        return () => {
            clearInterval(interval);
        };
    }, [client, pollInterval, onUpdate, onError, ...deps]);
}
