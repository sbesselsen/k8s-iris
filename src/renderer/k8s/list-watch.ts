import { useEffect, useState } from "react";
import {
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatcherMessage,
} from "../../common/k8s/client";
import { toK8sObjectIdentifierString } from "../../common/k8s/util";
import { coalesceValues } from "../../common/util/async";
import { k8sSmartCompare } from "../../common/util/sort";
import { useHibernatableReadableStore } from "../context/hibernate";
import { useK8sContext } from "../context/k8s-context";
import { useGuaranteedMemo } from "../hook/guaranteed-memo";
import { createStore, ReadableStore } from "../util/state";
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

    const store = useK8sListWatchStore<T>(spec, opts, deps);

    useEffect(() => {
        const listener = (v: K8sListWatchStoreValue<T>) => {
            if (v.error) {
                setValue([false, undefined, v.error]);
                return;
            }

            const items = [...v.identifiers].map((id) => v.resources[id]);
            items.sort(k8sSmartCompare);
            const list: K8sObjectList<T> = {
                apiVersion: spec.apiVersion,
                kind: spec.kind,
                items,
            };
            setValue(v.isLoading ? loadingValue : [false, list, undefined]);
        };

        listener(store.get());

        store.subscribe(listener);

        return () => {
            store.unsubscribe(listener);
        };
    }, [kubeContext, setValue, store, ...deps]);

    return value;
}

const minUpdateCoalesceInterval = 10;

export type K8sListWatchStoreValue<T extends K8sObject = K8sObject> = {
    isLoading: boolean;
    identifiers: Set<string>;
    resources: Record<string, T>;
    error?: any | undefined;
};

export type K8sListWatchStoreHookOptions = K8sListWatchHookOptions & {
    onWatchError?: (error: any) => void;
};

export function useK8sListWatchStore<T extends K8sObject = K8sObject>(
    specs: K8sObjectListQuery | K8sObjectListQuery[],
    options: K8sListWatchStoreHookOptions,
    deps: any[] = []
): ReadableStore<K8sListWatchStoreValue<T>> {
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
            (
                messages: Array<K8sObjectListWatcherMessage<T> | { error: any }>
            ) => {
                if (messages.length === 0) {
                    return;
                }
                store.set((oldValue) => {
                    let newIdentifiers = oldValue.identifiers;
                    let newResources = oldValue.resources;
                    let newError = oldValue.error;
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
                        if ("error" in message) {
                            newError = message.error;
                            continue;
                        } else {
                            newError = undefined;
                        }
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
                        newIsLoading !== oldValue.isLoading ||
                        newError !== oldValue.error
                    ) {
                        return {
                            identifiers: newIdentifiers,
                            resources: newResources,
                            isLoading: newIsLoading,
                            ...(newError ? { error: newError } : {}),
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
                    updateStore({
                        error,
                    });
                    return;
                }
                if (!message) {
                    const error = new Error(
                        "Unknown listWatch error: no message and no error"
                    );
                    onWatchError?.(error);
                    updateStore({ error });
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
    }, [client, updateCoalesceInterval, ...deps]);

    return useHibernatableReadableStore(store, pauseOnHibernate);
}
