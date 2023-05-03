import { useEffect } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../common/k8s/util";
import { useOptionalK8sContext } from "../context/k8s-context";
import { create } from "../util/state";
import { useK8sClient } from "./client";

type SharedMetrics = {
    nodeMetricsByContext: Record<string, K8sObject[]>;
    nodeMetricsListenersByContext: Record<string, number>;
};

const defaultSharedMetrics: SharedMetrics = {
    nodeMetricsByContext: {},
    nodeMetricsListenersByContext: {},
};

const { useStore, useStoreValue } = create(defaultSharedMetrics);

export type K8sNodeMetricsOptions = {
    kubeContext?: string;
};

export type K8sNodeMetricsListenerOptions = K8sNodeMetricsOptions & {
    onUpdate: (metrics: K8sObject | null) => void;
};

const emptyOnUpdate = () => {};

export function useK8sNodeMetrics(
    node: K8sObject | K8sObjectIdentifier,
    options?: K8sNodeMetricsOptions
): K8sObject | null {
    const sharedContext = useOptionalK8sContext();
    const { kubeContext = sharedContext } = options ?? {};
    if (!kubeContext) {
        throw new Error("Calling useK8sNodeMetrics() without kubeContext");
    }
    const nodeName = toK8sObjectIdentifier(node).name;
    useK8sNodeMetricsListener(node, {
        ...options,
        onUpdate: emptyOnUpdate,
    });
    return (
        useStoreValue().nodeMetricsByContext[kubeContext]?.find(
            (m) => m.metadata.name === nodeName
        ) ?? null
    );
}

export function useK8sNodeMetricsListener(
    node: K8sObject | K8sObjectIdentifier,
    options: K8sNodeMetricsListenerOptions
): void {
    const sharedContext = useOptionalK8sContext();
    const { kubeContext = sharedContext, onUpdate } = options ?? {};
    if (!kubeContext) {
        throw new Error(
            "Calling useK8sNodeMetricsListener() without kubeContext"
        );
    }

    const client = useK8sClient(kubeContext);
    const nodeName = toK8sObjectIdentifier(node).name;

    const store = useStore();

    useEffect(() => {
        let prevMetrics: K8sObject | null = null;
        const listener = (metrics: SharedMetrics) => {
            const newMetrics =
                (metrics.nodeMetricsByContext[kubeContext] ?? []).find(
                    (metrics) => metrics.metadata.name === nodeName
                ) ?? null;
            if (newMetrics !== prevMetrics) {
                prevMetrics = newMetrics;
                onUpdate(newMetrics);
            }
        };

        // Subscribe.
        store.subscribe(listener);

        // Serve cached metrics.
        listener(store.get());

        // Update listener count.
        const sharedMetrics = store.set((value) => {
            return {
                ...value,
                nodeMetricsListenersByContext: {
                    ...value.nodeMetricsListenersByContext,
                    [kubeContext]:
                        (value.nodeMetricsListenersByContext[kubeContext] ??
                            0) + 1,
                },
            };
        });

        // Subscribe to node metrics if this is the first listener.
        if (sharedMetrics.nodeMetricsListenersByContext[kubeContext] === 1) {
            // we are the first listener!
            console.log("subscribe to nodeMetrics", kubeContext);
            const updateMetrics = async () => {
                const result = await client.list({
                    apiVersion: "metrics.k8s.io/v1beta1",
                    kind: "NodeMetrics",
                });
                console.log("have metrics");
                store.set((value) => {
                    return {
                        ...value,
                        nodeMetricsByContext: {
                            ...value.nodeMetricsByContext,
                            [kubeContext]: result.items,
                        },
                    };
                });
            };

            // Get metrics on a periodic interval.
            const interval = setInterval(() => {
                if (
                    sharedMetrics.nodeMetricsListenersByContext[kubeContext] ===
                    0
                ) {
                    console.log("unsubscribe from nodeMetrics", kubeContext);

                    // Stop if we have no listeners any more.
                    clearInterval(interval);

                    // Clear currently cached data.
                    delete sharedMetrics.nodeMetricsByContext[kubeContext];

                    return;
                }
                updateMetrics();
            }, 10000);

            if (!sharedMetrics.nodeMetricsByContext[kubeContext]) {
                // Immediately fetch metrics.
                updateMetrics();
            }
        }

        return () => {
            // Unsubscribe.
            store.unsubscribe(listener);

            // Decrement listener count.
            store.set((value) => {
                return {
                    ...value,
                    nodeMetricsListenersByContext: {
                        ...value.nodeMetricsListenersByContext,
                        [kubeContext]:
                            value.nodeMetricsListenersByContext[kubeContext] -
                            1,
                    },
                };
            });
        };
    }, [client, kubeContext, nodeName, onUpdate, store]);
}
