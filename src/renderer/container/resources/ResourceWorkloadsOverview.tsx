import { Box } from "@chakra-ui/react";
import React, { useMemo } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { ResourceBadge } from "../../k8s/badges";
import { K8sListWatchHookOptions, useK8sListWatch } from "../../k8s/list-watch";

export const ResourceWorkloadsOverview: React.FC<{}> = () => {
    const resources = useCombinedWorkloadResourcesInfo();

    const groupedResources = useMemo(
        () => groupWorkloadResources(resources),
        [resources]
    );

    // console.log({ groupedResources });
    return <Box></Box>;
};

type WorkloadResourceGroup = {
    id: string;
    title: string;
    badges: ResourceBadge[];
    resources: Record<string, WorkloadResourceInfo>;
};

function groupWorkloadResources(
    resources: Record<string, WorkloadResourceInfo>
): Array<WorkloadResourceGroup> {
    // TODO: re-enable
    const [helmGroups, remainingResources] = helmGroupResources(resources);
    console.log("helm groups", helmGroups);
    console.log("remaining", remainingResources);
    return [
        ...helmGroups,
        {
            id: "other",
            title: "Other",
            badges: [],
            resources: remainingResources,
        },
    ];
}

function helmGroupResources(
    resources: Record<string, WorkloadResourceInfo>
): [Array<WorkloadResourceGroup>, Record<string, WorkloadResourceInfo>] {
    const groupInfo: Record<
        string,
        {
            instance: string;
            namespace: string;
            chart?: string;
            chartVersion?: string;
        }
    > = {};
    const namespacesByInstance: Record<string, Record<string, string>> = {};

    const findHelmGroup = (resource: K8sObject): string | null => {
        if (
            resource.metadata.namespace &&
            resource.metadata.labels?.["app.kubernetes.io/instance"]
        ) {
            const namespace = resource.metadata.namespace;

            // Keep track if we have the same instance name in multiple namespaces.
            const instance =
                resource.metadata.labels["app.kubernetes.io/instance"];
            if (!namespacesByInstance[instance]) {
                namespacesByInstance[instance] = {};
            }
            namespacesByInstance[instance][namespace] = namespace;
            const groupId = `${namespace}:${instance}`;

            if (!groupInfo[groupId]) {
                groupInfo[groupId] = { instance, namespace };
            }

            if (resource.metadata.labels?.["helm.sh/chart"]) {
                const chart = resource.metadata.labels?.["helm.sh/chart"];
                const match = chart.match(/^(.*)-([0-9\.]+)$/);
                if (match) {
                    groupInfo[groupId].chart = match[1];
                    groupInfo[groupId].chartVersion = match[2];
                } else if (!groupInfo[groupId].chart) {
                    groupInfo[groupId].chart = chart;
                }
            }
            return groupId;
        }
        return null;
    };

    // First find the Helm instances that are available.
    const helmGroups: Record<string, WorkloadResourceGroup> = {};
    const emptyResources: Record<string, WorkloadResourceInfo> =
        Object.fromEntries(
            Object.entries(resources).map(([k, v]) => [
                k,
                {
                    isLoading: v.isLoading,
                    error: v.error,
                    resources: [],
                },
            ])
        );
    const remainingResources: Record<string, WorkloadResourceInfo> =
        structuredClone(emptyResources);
    for (const [k, resourceInfo] of Object.entries(resources)) {
        for (const resource of resourceInfo.resources) {
            const helmGroup = findHelmGroup(resource);
            if (helmGroup) {
                if (!helmGroups[helmGroup]) {
                    helmGroups[helmGroup] = {
                        id: helmGroup,
                        title: groupInfo[helmGroup].instance,
                        badges: [],
                        resources: structuredClone(emptyResources),
                    };
                }
                helmGroups[helmGroup].resources[k].resources.push(resource);
            } else {
                remainingResources[k].resources.push(resource);
            }
        }
    }

    // TODO: add configmaps, secrets

    // Make the group titles nicer.
    for (const helmGroup of Object.values(helmGroups)) {
        const info = groupInfo[helmGroup.id];
        // Add namespace to the title if necessary.
        if (
            namespacesByInstance[info.instance] &&
            Object.values(namespacesByInstance[info.instance]).length > 1
        ) {
            helmGroup.title = `${info.instance} (${info.namespace})`;
        }
        if (info.chart) {
            helmGroup.badges.push({
                id: "chart",
                text: `Chart: ${info.chart}`,
                variant: "other",
            });
        }
        if (info.chartVersion) {
            helmGroup.badges.push({
                id: "chart-version",
                text: `Chart version: ${info.chartVersion}`,
                variant: "other",
            });
        }
    }

    return [Object.values(helmGroups), remainingResources];
}

type WorkloadResourceInfo = {
    isLoading: boolean;
    resources: K8sObject[];
    error: any | undefined;
};

function useCombinedWorkloadResourcesInfo(): Record<
    string,
    WorkloadResourceInfo
> {
    const namespaces = useK8sNamespaces();

    const listWatchOptions: K8sListWatchHookOptions = useMemo(
        () => ({
            updateCoalesceInterval: namespaces.mode === "all" ? 5000 : 1000,
        }),
        [namespaces.mode]
    );

    const deployments = useWorkloadResourceInfo(
        {
            apiVersion: "apps/v1",
            kind: "Deployment",
        },
        namespaces,
        listWatchOptions
    );
    const statefulSets = useWorkloadResourceInfo(
        {
            apiVersion: "apps/v1",
            kind: "StatefulSet",
        },
        namespaces,
        listWatchOptions
    );
    const daemonSets = useWorkloadResourceInfo(
        {
            apiVersion: "apps/v1",
            kind: "DaemonSet",
        },
        namespaces,
        listWatchOptions
    );
    const services = useWorkloadResourceInfo(
        {
            apiVersion: "v1",
            kind: "Service",
        },
        namespaces,
        listWatchOptions
    );
    const configMaps = useWorkloadResourceInfo(
        {
            apiVersion: "v1",
            kind: "ConfigMap",
        },
        namespaces,
        listWatchOptions
    );
    const secrets = useWorkloadResourceInfo(
        {
            apiVersion: "v1",
            kind: "Secret",
        },
        namespaces,
        listWatchOptions
    );
    const ingresses = useWorkloadResourceInfo(
        {
            apiVersion: "networking.k8s.io/v1",
            kind: "Ingress",
        },
        namespaces,
        listWatchOptions
    );
    return useMemo(
        () => ({
            deployments,
            statefulSets,
            daemonSets,
            services,
            configMaps,
            secrets,
            ingresses,
        }),
        [
            deployments,
            statefulSets,
            daemonSets,
            services,
            configMaps,
            secrets,
            ingresses,
        ]
    );
}

function useWorkloadResourceInfo(
    resourceType: K8sResourceTypeIdentifier,
    namespaces: AppNamespacesSelection,
    listWatchOptions: K8sListWatchHookOptions
): WorkloadResourceInfo {
    const [isLoading, result, error] = useK8sListWatch(
        {
            ...resourceType,
            ...(namespaces.mode === "all"
                ? {}
                : { namespaces: namespaces.selected }),
        },
        listWatchOptions,
        [namespaces]
    );
    return useMemo(
        () => ({
            isLoading,
            error,
            resources: result?.items ?? [],
        }),
        [isLoading, error, result]
    );
}
