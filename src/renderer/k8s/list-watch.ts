import { useCallback, useEffect, useRef, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
    K8sObjectListWatcherMessage,
} from "../../common/k8s/client";
import { useHibernate } from "../context/hibernate";
import { useK8sContext } from "../context/k8s-context";
import { useK8sClient } from "./client";

const loadingValue: [boolean, undefined, undefined] = [
    true,
    undefined,
    undefined,
];

export type K8sListWatchOptions = {
    kubeContext?: string;
    pauseOnHibernate?: boolean;
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

    const {
        onUpdate,
        onWatchError,
        updateCoalesceInterval = 0,
        pauseOnHibernate = true,
    } = options;

    const isPaused = useHibernate() && pauseOnHibernate;

    const pausedUpdateRef = useRef<K8sCoalescedObjectListWatcherMessage<T>>();
    const pausableOnUpdate = useCallback(
        (message: K8sCoalescedObjectListWatcherMessage<T>) => {
            if (!isPaused) {
                onUpdate(message);
            } else {
                if (pausedUpdateRef.current) {
                    pausedUpdateRef.current.list = message.list;
                    pausedUpdateRef.current.updates.push(...message.updates);
                } else {
                    pausedUpdateRef.current = {
                        list: message.list,
                        updates: [...message.updates],
                    };
                }
            }
        },
        [onUpdate, pausedUpdateRef, isPaused]
    );
    useEffect(() => {
        if (!isPaused && pausedUpdateRef.current) {
            // Updates came in while we were paused.
            const message = pausedUpdateRef.current;
            pausedUpdateRef.current = undefined;
            onUpdate(message);
        }
    }, [onUpdate, pausedUpdateRef, isPaused]);

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
                        pausableOnUpdate(coalescedUpdateRef.current);
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
            pausableOnUpdate(coalescedMessage);
            lastUpdateTimestampRef.current = ts;
        },
        [
            coalescedUpdateRef,
            lastUpdateTimestampRef,
            pausableOnUpdate,
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
            lastUpdateTimestampRef.current = 0;
            listWatchRef.current = null;
            updateTimeoutRef.current = null;
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

export function useK8sListWatches<T extends K8sObject = K8sObject>(
    specs: Record<string, K8sObjectListQuery>,
    opts: K8sListWatchHookOptions,
    deps: any[] = []
): Record<string, [boolean, K8sObjectList<T> | undefined, any | undefined]> {
    const kubeContext = useK8sContext();

    const emptyState = () =>
        Object.fromEntries(Object.keys(specs).map((k) => [k, loadingValue]));

    const [value, setValue] = useState<
        Record<string, [boolean, K8sObjectList<T> | undefined, any | undefined]>
    >(emptyState());

    useEffect(() => {
        setValue(emptyState());
    }, [kubeContext, setValue]);

    const onUpdate = useCallback(
        (
            messages: Record<
                string,
                K8sCoalescedObjectListWatcherMessage<K8sObject>
            >
        ) => {
            setValue((value) => ({
                ...value,
                ...Object.fromEntries(
                    Object.entries(messages).map(([k, message]) => [
                        k,
                        [false, message.list as any, undefined],
                    ])
                ),
            }));
        },
        [setValue]
    );

    const onWatchError = useCallback(
        (key: string, error: any) => {
            setValue((value) => ({
                ...value,
                [key]: [false, undefined, error],
            }));
        },
        [setValue]
    );

    useK8sListWatchesListener(
        specs,
        {
            ...opts,
            onUpdate,
            onWatchError,
        },
        deps
    );

    return value;
}

export type K8sListWatchesListenerOptions<T extends K8sObject = K8sObject> =
    K8sListWatchOptions & {
        onUpdate: (
            messages: Record<string, K8sCoalescedObjectListWatcherMessage<T>>
        ) => void;
        onWatchError: (key: string, error: any) => void;
        updateCoalesceInterval?: number;
    };

export function useK8sListWatchesListener<T extends K8sObject = K8sObject>(
    specs: Record<string, K8sObjectListQuery>,
    options: K8sListWatchesListenerOptions,
    deps: any[] = []
): void {
    const client = useK8sClient(options.kubeContext);
    const listWatchesRef = useRef<
        Record<string, K8sObjectListWatch> | undefined
    >();

    const {
        onUpdate,
        onWatchError,
        updateCoalesceInterval = 0,
        pauseOnHibernate = true,
    } = options;

    const isPaused = useHibernate() && pauseOnHibernate;

    const pausedUpdateRef =
        useRef<Record<string, K8sCoalescedObjectListWatcherMessage<T>>>();
    const pausableOnUpdate = useCallback(
        (messages: Record<string, K8sCoalescedObjectListWatcherMessage<T>>) => {
            if (!isPaused) {
                onUpdate(messages);
            } else {
                if (!pausedUpdateRef.current) {
                    pausedUpdateRef.current = {};
                }
                for (const [k, message] of Object.entries(messages)) {
                    if (pausedUpdateRef.current[k]) {
                        pausedUpdateRef.current[k].list = message.list;
                        pausedUpdateRef.current[k].updates.push(
                            ...message.updates
                        );
                    } else {
                        pausedUpdateRef.current[k] = {
                            list: message.list,
                            updates: [...message.updates],
                        };
                    }
                }
            }
        },
        [onUpdate, pausedUpdateRef, isPaused]
    );
    useEffect(() => {
        if (!isPaused && pausedUpdateRef.current) {
            // Updates came in while we were paused.
            const messages = pausedUpdateRef.current;
            pausedUpdateRef.current = undefined;
            onUpdate(messages);
        }
    }, [onUpdate, pausedUpdateRef, isPaused]);

    const specKeysString = Object.keys(specs).sort().join(",");

    const lastUpdateTimestampRef = useRef(0);
    const coalescedUpdateRef =
        useRef<Record<string, K8sCoalescedObjectListWatcherMessage<T>>>();
    const updateTimeoutRef = useRef<any>();
    const keysWithInitialMessageRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        keysWithInitialMessageRef.current.clear();
    }, [keysWithInitialMessageRef, specKeysString, ...deps]);
    const coalescedOnUpdate = useCallback(
        (messages: Record<string, K8sObjectListWatcherMessage<T>>) => {
            const boundedUpdateCoalesceInterval = Math.max(
                minUpdateCoalesceInterval,
                updateCoalesceInterval
            );

            const allInitialSpecsFulfilled =
                keysWithInitialMessageRef.current.size >=
                Object.keys(specs).length;

            for (const k of Object.keys(messages)) {
                keysWithInitialMessageRef.current.add(k);
            }

            const ts = new Date().getTime();
            if (
                lastUpdateTimestampRef.current + boundedUpdateCoalesceInterval >
                    ts &&
                allInitialSpecsFulfilled
            ) {
                for (const [k, message] of Object.entries(messages)) {
                    if (!coalescedUpdateRef.current) {
                        coalescedUpdateRef.current = {};
                    }
                    if (!coalescedUpdateRef.current[k]) {
                        coalescedUpdateRef.current[k] = {
                            list: message.list,
                            updates: [],
                        };
                    }
                    coalescedUpdateRef.current[k].list = message.list;
                    if (message.update) {
                        coalescedUpdateRef.current[k].updates.push(
                            message.update
                        );
                    }
                }

                // Update is coming in too soon. Need to schedule it.
                if (!updateTimeoutRef.current) {
                    updateTimeoutRef.current = setTimeout(() => {
                        if (coalescedUpdateRef.current) {
                            pausableOnUpdate(coalescedUpdateRef.current);
                        }
                        lastUpdateTimestampRef.current = ts;
                        updateTimeoutRef.current = null;
                        coalescedUpdateRef.current = undefined;
                    }, lastUpdateTimestampRef.current + boundedUpdateCoalesceInterval - ts);
                }
                return;
            }

            // We can do the update immediately. Cancel any scheduled updates and go.
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }
            coalescedUpdateRef.current = undefined;

            const coalescedMessages: Record<
                string,
                K8sCoalescedObjectListWatcherMessage<T>
            > = {};
            for (const [k, message] of Object.entries(messages)) {
                const coalescedMessage: K8sCoalescedObjectListWatcherMessage<T> =
                    {
                        list: message.list,
                        updates: [],
                    };
                if (message.update) {
                    coalescedMessage.updates.push(message.update);
                }
                coalescedMessages[k] = coalescedMessage;
            }
            pausableOnUpdate(coalescedMessages);
            lastUpdateTimestampRef.current = ts;
        },
        [
            coalescedUpdateRef,
            lastUpdateTimestampRef,
            pausableOnUpdate,
            updateCoalesceInterval,
            updateTimeoutRef,
            specKeysString,
            keysWithInitialMessageRef,
        ]
    );

    useEffect(() => {
        lastUpdateTimestampRef.current = 0;
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
            updateTimeoutRef.current = null;
        }
        coalescedUpdateRef.current = undefined;

        // Create listWatches for each of the specs.
        const listWatches = Object.fromEntries(
            Object.entries(specs)
                .map(([k, spec]) => {
                    try {
                        const listWatch = client.listWatch<T>(
                            spec,
                            (error, message) => {
                                if (error) {
                                    onWatchError(k, error);
                                } else if (message) {
                                    coalescedOnUpdate({ [k]: message });
                                }
                            }
                        );
                        return [k, listWatch];
                    } catch (e) {
                        onWatchError(k, e);
                    }
                })
                .filter((entry) => entry !== undefined) as Array<
                [string, K8sObjectListWatch]
            >
        );

        listWatchesRef.current = listWatches;
        return () => {
            Object.values(listWatchesRef.current ?? {}).forEach((lw) =>
                lw.stop()
            );
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            coalescedUpdateRef.current = undefined;
            lastUpdateTimestampRef.current = 0;
            listWatchesRef.current = {};
            updateTimeoutRef.current = null;
        };
    }, [
        client,
        coalescedUpdateRef,
        lastUpdateTimestampRef,
        listWatchesRef,
        coalescedOnUpdate,
        onWatchError,
        ...deps,
    ]);
}
