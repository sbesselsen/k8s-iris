import { useCallback, useEffect, useRef, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
    K8sObjectListWatcherMessage,
} from "../../common/k8s/client";
import { toK8sObjectIdentifierString } from "../../common/k8s/util";
import { coalesceValues } from "../../common/util/async";
import { useHibernateGetter, useHibernateListener } from "../context/hibernate";
import { useK8sContext } from "../context/k8s-context";
import { useGuaranteedMemo } from "../hook/guaranteed-memo";
import { createStore, Store } from "../util/state";
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

    const getHibernate = useHibernateGetter();
    const getIsPaused = useCallback(() => {
        return pauseOnHibernate && getHibernate();
    }, [pauseOnHibernate]);

    const pausedUpdateRef = useRef<K8sCoalescedObjectListWatcherMessage<T>>();
    const pausableOnUpdate = useCallback(
        (message: K8sCoalescedObjectListWatcherMessage<T>) => {
            if (!getIsPaused()) {
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
        [onUpdate, pausedUpdateRef, getIsPaused]
    );

    useHibernateListener(
        (isHibernating) => {
            if (!isHibernating && pausedUpdateRef.current) {
                // Updates came in while we were paused.
                const message = pausedUpdateRef.current;
                pausedUpdateRef.current = undefined;
                onUpdate(message);
            }
        },
        [onUpdate, pausedUpdateRef]
    );

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
                        if (coalescedUpdateRef.current) {
                            pausableOnUpdate(coalescedUpdateRef.current);
                        }
                        lastUpdateTimestampRef.current = ts;
                        updateTimeoutRef.current = undefined;
                        coalescedUpdateRef.current = undefined;
                    }, lastUpdateTimestampRef.current + boundedUpdateCoalesceInterval - ts);
                }
                return;
            }

            // We can do the update immediately. Cancel any scheduled updates and go.
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = undefined;
            }
            coalescedUpdateRef.current = undefined;

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
                updateTimeoutRef.current = undefined;
            }
            coalescedUpdateRef.current = undefined;

            const listWatch = client.listWatch<T>(spec, (error, message) => {
                if (error) {
                    onWatchError(error);
                    return;
                }
                if (!message) {
                    onWatchError(
                        new Error(
                            "Unknown listWatch error: no message and no error"
                        )
                    );
                    return;
                }
                coalescedOnUpdate(message);
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
            coalescedUpdateRef.current = undefined;
            lastUpdateTimestampRef.current = 0;
            listWatchRef.current = undefined;
            updateTimeoutRef.current = undefined;
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

export type K8sListWatchStoreValue<T extends K8sObject = K8sObject> = {
    isLoading: boolean;
    identifiers: Set<string>;
    resources: Record<string, T>;
};

export type K8sListWatchStoreHookOptions = K8sListWatchHookOptions & {
    onWatchError?: (error: any) => void;
};

export function useK8sListWatchStore<T extends K8sObject = K8sObject>(
    specs: K8sObjectListQuery | K8sObjectListQuery[],
    options: K8sListWatchStoreHookOptions,
    deps: any[] = []
): Store<K8sListWatchStoreValue<T>> {
    const {
        pauseOnHibernate = true,
        updateCoalesceInterval = 0,
        onWatchError,
    } = options;

    const client = useK8sClient(options.kubeContext);

    const store = useGuaranteedMemo(
        () =>
            createStore<K8sListWatchStoreValue<T>>({
                isLoading: true,
                identifiers: new Set(),
                resources: {},
            }),
        deps
    );

    useEffect(() => {
        const specsArray = Array.isArray(specs) ? specs : [specs];

        const boundedUpdateCoalesceInterval = Math.max(
            minUpdateCoalesceInterval,
            updateCoalesceInterval
        );
        const lists: Array<Array<T>> = specsArray.map(() => []);
        const isLoading: boolean[] = specsArray.map(() => true);

        const updateStore = coalesceValues(
            (messages: Array<K8sObjectListWatcherMessage<T>>) => {
                if (messages.length === 0) {
                    return;
                }
                store.set((oldValue) => {
                    let newIdentifiers = oldValue.identifiers;
                    let newResources = oldValue.resources;
                    const newIsLoading = isLoading.some((l) => l);

                    function updateIdentifiers(f: (set: Set<string>) => void) {
                        if (newIdentifiers === oldValue.identifiers) {
                            newIdentifiers = new Set([...oldValue.identifiers]);
                        }
                        f(newIdentifiers);
                    }

                    function updateResources(
                        f: (value: Record<string, T>) => void
                    ) {
                        if (newResources === oldValue.resources) {
                            newResources = { ...oldValue.resources };
                        }
                        f(newResources);
                    }

                    for (const message of messages) {
                        const { update, list } = message;
                        if (update) {
                            const identifier = toK8sObjectIdentifierString(
                                update.object
                            );
                            switch (update.type) {
                                case "add":
                                    if (!newIdentifiers.has(identifier)) {
                                        updateIdentifiers((s) => {
                                            s.add(identifier);
                                        });
                                    }
                                    updateResources((r) => {
                                        r[identifier] = update.object;
                                    });
                                    break;
                                case "remove":
                                    if (newIdentifiers.has(identifier)) {
                                        updateIdentifiers((s) => {
                                            s.delete(identifier);
                                        });
                                    }
                                    updateResources((r) => {
                                        delete r[identifier];
                                    });
                                    break;
                                case "update":
                                    updateResources((r) => {
                                        r[identifier] = update.object;
                                    });
                                    break;
                            }
                        } else {
                            // A new list.
                            for (const object of list.items) {
                                const identifier =
                                    toK8sObjectIdentifierString(object);
                                if (!newIdentifiers.has(identifier)) {
                                    updateIdentifiers((s) => {
                                        s.add(identifier);
                                    });
                                }
                                updateResources((r) => {
                                    r[identifier] = object;
                                });
                            }
                        }
                    }

                    if (
                        newIdentifiers !== oldValue.identifiers ||
                        newResources !== oldValue.resources ||
                        newIsLoading !== oldValue.isLoading
                    ) {
                        return {
                            identifiers: newIdentifiers,
                            resources: newResources,
                            isLoading: newIsLoading,
                        };
                    }
                    return oldValue;
                });
            },
            boundedUpdateCoalesceInterval
        );

        const listWatches = specsArray.map((spec, listWatchIndex) =>
            client.listWatch<T>(spec, (error, message) => {
                if (error) {
                    console.error("Errors loading listWatch", error);
                    onWatchError?.(error);
                    return;
                }
                if (!message) {
                    onWatchError?.(
                        new Error(
                            "Unknown listWatch error: no message and no error"
                        )
                    );
                    return;
                }
                lists[listWatchIndex] = message.list.items;
                isLoading[listWatchIndex] = false;
                updateStore(message);
            })
        );
        return () => {
            // Stop all the listWatches.
            listWatches.forEach((l) => l.stop());
        };
    }, [client, pauseOnHibernate, updateCoalesceInterval, ...deps]);

    return store;
}
