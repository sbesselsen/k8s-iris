import { useEffect } from "react";
import {
    K8sClient,
    K8sObjectListWatch,
    K8sResourceTypeInfo,
} from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { create } from "../util/state";
import { useK8sClient } from "./client";

type ResourceTypeListenersHandle = {
    value: {
        isLoading: boolean;
        error: any | undefined;
        resourceTypes: K8sResourceTypeInfo[] | undefined;
    };
    client: K8sClient;
    listenersCount: number;
};

const { useStore, useStoreValue, store } = create(
    {} as Record<string, ResourceTypeListenersHandle>
);

const listWatches: Record<string, K8sObjectListWatch> = {};
store.subscribe((handles) => {
    for (const context of Object.keys(handles)) {
        if (!listWatches[context]) {
            console.log("Start tracking resource types", context);

            let stopped = false;
            // Set a temporary listWatch handle.
            listWatches[context] = {
                stop() {
                    stopped = true;
                },
            };

            const setErrorValue = (error: any) => {
                store.set((handles) => ({
                    ...handles,
                    [context]: {
                        ...handles[context],
                        value: {
                            isLoading: false,
                            error,
                            resourceTypes: handles[context].value.resourceTypes,
                        },
                    },
                }));
            };
            const setResultValue = (result: K8sResourceTypeInfo[]) => {
                store.set((handles) => ({
                    ...handles,
                    [context]: {
                        ...handles[context],
                        value: {
                            isLoading: false,
                            error: undefined,
                            resourceTypes: result,
                        },
                    },
                }));
            };

            (async () => {
                let haveInitialList = false;
                try {
                    const types = await handles[
                        context
                    ].client.listApiResourceTypes();
                    setResultValue(types);
                    haveInitialList = true;
                } catch (e) {
                    // Nothing.
                }
                if (stopped) {
                    return;
                }

                // Create a new listwatch to keep the store value up-to-date.
                listWatches[context] = handles[context].client.listWatch(
                    {
                        apiVersion: "apiextensions.k8s.io/v1",
                        kind: "CustomResourceDefinition",
                    },
                    (error, message) => {
                        if (error) {
                            setErrorValue(error);
                        } else {
                            if (!message?.update && haveInitialList) {
                                // Don't run listApiResourceTypes() after initial list result, because it would be duplication.
                                return;
                            }
                            const myListWatch = listWatches[context];
                            // Load the resource types list.
                            (async () => {
                                try {
                                    const types = await handles[
                                        context
                                    ].client.listApiResourceTypes();
                                    if (myListWatch === listWatches[context]) {
                                        setResultValue(types);
                                    }
                                } catch (e) {
                                    if (myListWatch === listWatches[context]) {
                                        setErrorValue(e);
                                    }
                                }
                            })();
                        }
                    }
                );
            })();
        }
    }
    for (const context of Object.keys(listWatches)) {
        if (!handles[context]) {
            // Remove the listwatch; it is no longer neeeded.
            console.log("Stop tracking resource types", context);
            listWatches[context].stop();
            delete listWatches[context];
        }
    }
});

const emptyState = {
    isLoading: true,
    error: undefined,
    resourceTypes: undefined,
};

export function useK8sApiResourceTypes(): [
    boolean,
    K8sResourceTypeInfo[] | undefined,
    any | undefined
] {
    const context = useK8sContext() ?? "";
    const client = useK8sClient();
    const store = useStore();

    // Register/deregister.
    useEffect(() => {
        store.set((handles) => {
            const handle = handles[context] ?? {
                value: {
                    isLoading: true,
                    error: undefined,
                    resourceTypes: undefined,
                },
                client,
                listenersCount: 0,
            };
            return {
                ...handles,
                [context]: {
                    ...handle,
                    listenersCount: handle.listenersCount + 1,
                },
            };
        });
        return () => {
            store.set((handles) => {
                const handle = handles[context];
                if (handle.listenersCount <= 1) {
                    // We are the last listener; remove this handle.
                    const handlesClone = { ...handles };
                    delete handlesClone[context];
                    return handlesClone;
                } else {
                    return {
                        ...handles,
                        [context]: {
                            ...handle,
                            listenersCount: handle.listenersCount - 1,
                        },
                    };
                }
            });
        };
    }, [client, context]);

    const { isLoading, resourceTypes, error } = useStoreValue(
        (handles) => handles[context]?.value ?? emptyState,
        [context]
    );

    return [isLoading, resourceTypes, error];
}
