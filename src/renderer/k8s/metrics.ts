import { useEffect, useMemo } from "react";
import {
    K8sClient,
    K8sObject,
    K8sObjectIdentifier,
    K8sObjectListQuery,
} from "../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../common/k8s/util";
import { useHibernatableReadableStore } from "../context/hibernate";
import { useOptionalK8sContext } from "../context/k8s-context";
import { create, Store, useProvidedStoreValue } from "../util/state";
import { useK8sClient } from "./client";

type SharedMetrics = {
    requestedMetrics: Record<string, number>;
    metrics: Record<string, K8sObject[]>;
    metricsTimestamps: Record<string, number>;
    clients: Record<string, K8sClient>;
    isMonitoring: boolean;
};

const defaultSharedMetrics: SharedMetrics = {
    requestedMetrics: {},
    metrics: {},
    metricsTimestamps: {},
    clients: {},
    isMonitoring: false,
};

const metricsInterval = 15000;

const { useStore, useStoreValue } = create(defaultSharedMetrics);

export type K8sMetricsOptions = {
    kubeContext?: string;
    pauseOnHibernate?: boolean;
};

export function useK8sNodeMetrics(
    node: K8sObject | K8sObjectIdentifier,
    options?: K8sMetricsOptions
): K8sObject | null {
    const nodesMetrics = useK8sNodesMetrics(options);
    const nodeName = toK8sObjectIdentifier(node).name;
    return nodesMetrics.find((m) => m.metadata.name === nodeName) ?? null;
}

export function useK8sNodesMetrics(options?: K8sMetricsOptions): K8sObject[] {
    const sharedContext = useOptionalK8sContext();
    const { kubeContext = sharedContext } = options ?? {};
    if (!kubeContext) {
        throw new Error("Calling useK8sNodeMetrics() without kubeContext");
    }

    const client = useK8sClient(kubeContext);

    const store = useStore();
    const key = JSON.stringify([kubeContext, "nodes", "*"]);

    useEffect(() => {
        registerMonitor(store);

        // Subscribe.
        store.set((value) => ({
            ...value,
            requestedMetrics: {
                ...value.requestedMetrics,
                [key]: (value.requestedMetrics[key] ?? 0) + 1,
            },
            clients: { ...value.clients, [kubeContext]: client },
        }));

        return () => {
            // Unsubscribe.
            store.set((value) => ({
                ...value,
                requestedMetrics: {
                    ...value.requestedMetrics,
                    [key]: Math.max((value.requestedMetrics[key] ?? 0) - 1, 0),
                },
            }));
        };
    }, [client, key]);

    return useStoreValue((v) => v.metrics[key] ?? [], [key]);
}

export function useK8sPodMetrics(
    pod: K8sObject | K8sObjectIdentifier,
    options?: K8sMetricsOptions
): K8sObject | null {
    return useK8sPodListMetrics([pod], options)[0] ?? null;
}

export function useK8sPodListMetrics(
    pods: Array<K8sObject | K8sObjectIdentifier>,
    options?: K8sMetricsOptions
): K8sObject[] {
    const podIdentifiers = pods.map(toK8sObjectIdentifier);
    const podNamesSet = new Set(podIdentifiers.map((i) => i.name));
    const podNamespaces = [
        ...new Set(podIdentifiers.map((i) => i.namespace as string)),
    ];

    const allMetrics = useK8sPodNamespacesMetrics(podNamespaces, options);
    return useMemo(
        () => allMetrics.filter((m) => podNamesSet.has(m.metadata.name)),
        [allMetrics, [...podNamesSet].join(",")]
    );
}

export function useK8sPodNamespacesMetrics(
    namespaces: string[],
    options?: K8sMetricsOptions
): K8sObject[] {
    const sharedContext = useOptionalK8sContext();
    const { kubeContext = sharedContext, pauseOnHibernate = true } =
        options ?? {};
    if (!kubeContext) {
        throw new Error("Calling useK8sPodMetrics() without kubeContext");
    }

    const client = useK8sClient(kubeContext);

    const store = useStore();
    const key = JSON.stringify([kubeContext, "pods", namespaces.join(",")]);

    useEffect(() => {
        registerMonitor(store);

        // Subscribe.
        store.set((value) => ({
            ...value,
            requestedMetrics: {
                ...value.requestedMetrics,
                [key]: (value.requestedMetrics[key] ?? 0) + 1,
            },
            clients: { ...value.clients, [kubeContext]: client },
        }));

        return () => {
            // Unsubscribe.
            store.set((value) => ({
                ...value,
                requestedMetrics: {
                    ...value.requestedMetrics,
                    [key]: Math.max((value.requestedMetrics[key] ?? 0) - 1, 0),
                },
            }));
        };
    }, [client, key]);

    const allPodMetricsStore = useHibernatableReadableStore(
        store,
        pauseOnHibernate
    );
    return useProvidedStoreValue(
        allPodMetricsStore,
        (v) => v.metrics[key] ?? [],
        [key]
    );
}

let isFetching: Record<string, boolean> = {};

function registerMonitor(store: Store<SharedMetrics>) {
    if (store.get().isMonitoring) {
        return;
    }

    isFetching = {};

    store.set((value) => ({ ...value, isMonitoring: true }));

    const subscriptions: Record<string, any> = {};

    store.subscribe((value) => {
        const { requestedMetrics } = value;
        const keysToSubscribe = Object.entries(requestedMetrics)
            .filter(([key, n]) => n > 0 && !subscriptions[key])
            .map(([key]) => key);
        const keysToUnsubscribe = Object.keys(subscriptions).filter(
            (key) => !requestedMetrics[key] || requestedMetrics[key] < 0
        );

        for (const key of keysToSubscribe) {
            console.log("Subscribe to metrics", key);
            const fetch = () => {
                fetchMetrics(store, key);
            };
            setTimeout(fetch, 0);
            subscriptions[key] = setInterval(fetch, metricsInterval);
        }
        for (const key of keysToUnsubscribe) {
            clearInterval(subscriptions[key]);
            delete subscriptions[key];
            console.log("Unsubscribe from metrics", key);
        }
    });
}

async function fetchMetrics(store: Store<SharedMetrics>, key: string) {
    const [context, type, selector] = JSON.parse(key);

    const { clients, metricsTimestamps } = store.get();
    const ts = new Date().getTime();

    if (
        metricsTimestamps[key] &&
        ts - metricsTimestamps[key] < metricsInterval
    ) {
        // Don't fetch again, the cached data is still good.
        return;
    }

    if (isFetching[key]) {
        // Already fetching these metrics.
        console.log("Skip fetching metrics, already fetching", key);
        return;
    }

    isFetching[key] = true;

    try {
        const client = clients[context];

        let query: K8sObjectListQuery | null = null;

        switch (type) {
            case "nodes":
                query = {
                    apiVersion: "metrics.k8s.io/v1beta1",
                    kind: "NodeMetrics",
                };
                break;
            case "pods":
                query = {
                    apiVersion: "metrics.k8s.io/v1beta1",
                    kind: "PodMetrics",
                    namespaces: ("" + selector).split(","),
                };
                break;
        }

        if (query) {
            const data = await client.list(query);
            store.set((value) => ({
                ...value,
                metricsTimestamps: {
                    ...value.metricsTimestamps,
                    [key]: ts,
                },
                metrics: {
                    ...value.metrics,
                    [key]: data.items,
                },
            }));
        }
        delete isFetching[key];
    } catch (e) {
        delete isFetching[key];
        throw e;
    }
}
