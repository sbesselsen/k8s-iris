import { useCallback, useEffect, useRef, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
    K8sObjectListWatcherMessage,
} from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { useK8sClient } from "./client";

const loadingValue: [boolean, undefined, undefined] = [
    true,
    undefined,
    undefined,
];

export type K8sListWatchOptions = {
    kubeContext?: string;
};

export type K8sCoalescedObjectListWatcherMessage<
    T extends K8sObject = K8sObject
> = {
    list: K8sObjectList<T>;
    updates: Array<K8sObjectListUpdate<T>>;
};

export type K8sListWatchHookOptions = K8sListWatchOptions & {
    updateCoalesceInterval?: number;
};

export function useK8sListWatch<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    opts: K8sListWatchHookOptions,
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
        (message: K8sCoalescedObjectListWatcherMessage<K8sObject>) => {
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
            ...opts,
            onUpdate,
            onWatchError,
        },
        deps
    );

    return value;
}

export type K8sListWatchListenerOptions<T extends K8sObject = K8sObject> =
    K8sListWatchOptions & {
        onUpdate: (message: K8sCoalescedObjectListWatcherMessage<T>) => void;
        onWatchError: (error: any) => void;
        updateCoalesceInterval?: number;
    };

const minUpdateCoalesceInterval = 10;

export function useK8sListWatchListener<T extends K8sObject = K8sObject>(
    spec: K8sObjectListQuery,
    options: K8sListWatchListenerOptions,
    deps: any[] = []
): void {
    const client = useK8sClient(options.kubeContext);
    const listWatchRef = useRef<K8sObjectListWatch | undefined>();

    const { onUpdate, onWatchError, updateCoalesceInterval = 0 } = options;

    const lastUpdateTimestampRef = useRef(0);
    const coalescedUpdateRef =
        useRef<K8sCoalescedObjectListWatcherMessage<T>>();
    const updateTimeoutRef = useRef<any>();
    const coalescedOnUpdate = useCallback(
        (message: K8sObjectListWatcherMessage<T>) => {
            const boundedUpdateCoalesceInterval = Math.max(
                minUpdateCoalesceInterval,
                updateCoalesceInterval
            );
            const ts = new Date().getTime();
            if (
                lastUpdateTimestampRef.current + boundedUpdateCoalesceInterval >
                ts
            ) {
                if (!coalescedUpdateRef.current) {
                    coalescedUpdateRef.current = {
                        list: message.list,
                        updates: [],
                    };
                }
                coalescedUpdateRef.current.list = message.list;
                if (message.update) {
                    coalescedUpdateRef.current.updates.push(message.update);
                }

                // Update is coming in too soon. Need to schedule it.
                if (!updateTimeoutRef.current) {
                    updateTimeoutRef.current = setTimeout(() => {
                        onUpdate(coalescedUpdateRef.current);
                        lastUpdateTimestampRef.current = ts;
                        updateTimeoutRef.current = null;
                        coalescedUpdateRef.current = null;
                    }, lastUpdateTimestampRef.current + boundedUpdateCoalesceInterval - ts);
                }
                return;
            }

            // We can do the update immediately. Cancel any scheduled updates and go.
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }
            coalescedUpdateRef.current = null;

            const coalescedMessage: K8sCoalescedObjectListWatcherMessage<T> = {
                list: message.list,
                updates: [],
            };
            if (message.update) {
                coalescedMessage.updates.push(message.update);
            }
            onUpdate(coalescedMessage);
            lastUpdateTimestampRef.current = ts;
        },
        [
            coalescedUpdateRef,
            lastUpdateTimestampRef,
            onUpdate,
            updateCoalesceInterval,
            updateTimeoutRef,
        ]
    );

    useEffect(() => {
        try {
            lastUpdateTimestampRef.current = 0;
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }
            coalescedUpdateRef.current = null;

            const listWatch = client.listWatch<T>(spec, (error, message) => {
                if (error) {
                    onWatchError(error);
                } else {
                    coalescedOnUpdate(message);
                }
            });
            listWatchRef.current = listWatch;
        } catch (e) {
            onWatchError(e);
        }
        return () => {
            listWatchRef.current?.stop();
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            coalescedUpdateRef.current = null;
            lastUpdateTimestampRef.current = null;
            listWatchRef.current = null;
        };
    }, [
        client,
        coalescedUpdateRef,
        lastUpdateTimestampRef,
        listWatchRef,
        coalescedOnUpdate,
        onWatchError,
        ...deps,
    ]);
}
