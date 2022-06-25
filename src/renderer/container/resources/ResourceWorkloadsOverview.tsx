import {
    Badge,
    Checkbox,
    Heading,
    HStack,
    Spinner,
    Table,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";
import React, { ChangeEvent, useCallback, useMemo } from "react";
import { K8sObject, K8sObjectListQuery } from "../../../common/k8s/client";
import { k8sSmartCompare } from "../../../common/util/sort";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import {
    K8sListWatchHookOptions,
    useK8sListWatches,
} from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";
import { ResourceEditorLink } from "./ResourceEditorLink";

export const ResourceWorkloadsOverview: React.FC<{}> = () => {
    const resources = useCombinedWorkloadResourcesInfo();

    console.log("render");

    const groupedResources = useMemo(
        () => groupWorkloadResources(resources),
        [resources]
    );

    return (
        <ScrollBox px={4} py={2} flex="1 0 0">
            <GroupedResourcesOverview groups={groupedResources} />
        </ScrollBox>
    );
};

type GroupedResourcesOverviewProps = {
    groups: WorkloadResourceGroup[];
};

const resourceTypeHeadings = {
    deployments: "Deployments",
    statefulSets: "StatefulSets",
    daemonSets: "DaemonSets",
    ingresses: "Ingresses",
    services: "Services",
    configMaps: "ConfigMaps",
    secrets: "Secrets",
};

const GroupedResourcesOverview: React.FC<GroupedResourcesOverviewProps> = (
    props
) => {
    const { groups } = props;

    const sortedGroups = useMemo(() => {
        let otherGroup: WorkloadResourceGroup | undefined;
        const namedGroups = groups.filter((g) => {
            if (g.id === "other") {
                otherGroup = g;
                return false;
            }
            return true;
        });
        const sortedGroups = namedGroups.sort((a, b) =>
            k8sSmartCompare(a.title, b.title)
        );
        if (otherGroup) {
            sortedGroups.push(otherGroup);
        }
        return sortedGroups;
    }, [groups]);

    const groupEdgeBg = useColorModeValue("gray.100", "gray.700");
    const groupContentBg = useColorModeValue("white", "gray.900");
    const headingColor = useColorModeValue("primary.500", "primary.400");

    const namespaces = useK8sNamespaces();
    const showNamespace =
        namespaces.mode === "all" || namespaces.selected.length > 1;

    return (
        <VStack alignItems="stretch" spacing={4}>
            {sortedGroups.map((group) => (
                <VStack
                    key={group.id}
                    bg={groupEdgeBg}
                    alignItems="stretch"
                    borderRadius={12}
                    p={2}
                    maxWidth="1000px"
                >
                    <Heading
                        fontSize="xs"
                        ps={4}
                        fontWeight="semibold"
                        textColor={headingColor}
                        textTransform="uppercase"
                    >
                        {group.title}
                    </Heading>
                    <VStack
                        alignItems="stretch"
                        bg={groupContentBg}
                        borderRadius={6}
                        spacing={4}
                        p={4}
                    >
                        {group.badges.length > 0 && (
                            <HStack>
                                {group.badges.map((badge) => {
                                    const {
                                        id,
                                        text,
                                        variant,
                                        details,
                                        badgeProps,
                                    } = badge;
                                    const colorScheme = {
                                        positive: "green",
                                        negative: "red",
                                        changing: "orange",
                                        other: "gray",
                                    }[variant ?? "other"];
                                    return (
                                        <Badge
                                            key={id}
                                            colorScheme={colorScheme}
                                            title={details ?? text}
                                            {...badgeProps}
                                        >
                                            {text}
                                        </Badge>
                                    );
                                })}
                            </HStack>
                        )}
                        {Object.entries(resourceTypeHeadings).map(
                            ([k, title]) => {
                                const resourcesInfo = group.resources[k];
                                return (
                                    <VStack key={k} alignItems="stretch">
                                        <Heading fontSize="sm">{title}</Heading>
                                        {resourcesInfo.isLoading && (
                                            <Spinner size="sm" ps={4} />
                                        )}
                                        {!resourcesInfo.isLoading &&
                                            resourcesInfo.resources.length >
                                                0 && (
                                                <WorkloadResourceList
                                                    showNamespace={
                                                        showNamespace
                                                    }
                                                    resources={
                                                        resourcesInfo.resources
                                                    }
                                                />
                                            )}
                                        {!resourcesInfo.isLoading &&
                                            resourcesInfo.resources.length ===
                                                0 && (
                                                <Text
                                                    textColor="gray"
                                                    fontSize="sm"
                                                >
                                                    None
                                                </Text>
                                            )}
                                    </VStack>
                                );
                            }
                        )}
                    </VStack>
                </VStack>
            ))}
        </VStack>
    );
};

type WorkloadResourceListProps = {
    resources: K8sObject[];
    showNamespace: boolean;
};

let counter = 0;
window.resetCounter = () => {
    counter = 0;
};
window.getCounter = () => counter;
window.getAndResetCounter = () => {
    const c = counter;
    counter = 0;
    return c;
};

const WorkloadResourceList: React.FC<WorkloadResourceListProps> = React.memo(
    (props) => {
        const { resources, showNamespace } = props;
        counter++;

        const sortedKeyedResources = useMemo(
            () =>
                [...resources]
                    .sort((a, b) =>
                        k8sSmartCompare(a.metadata.name, b.metadata.name)
                    )
                    .map((resource) => ({
                        resource,
                        key: `${resource.apiVersion}:${resource.kind}:${resource.metadata.namespace}:${resource.metadata.name}`,
                    })),
            [resources]
        );

        // TODO!
        const selectedResourceIdentifiers: string[] = [];

        const onChangeSelectAll = useCallback(
            (e: ChangeEvent<HTMLInputElement>) => {},
            []
        );
        const onSelectHandlers = useMemo(
            () =>
                Object.fromEntries(
                    sortedKeyedResources.map((r) => [
                        r.key,
                        (selected: boolean) => {
                            // TODO
                        },
                    ])
                ),
            [sortedKeyedResources]
        );

        return (
            <Table
                size="sm"
                sx={{ tableLayout: "fixed" }}
                width="100%"
                maxWidth="1000px"
            >
                <Thead>
                    <Tr>
                        <Th ps={2} width="40px">
                            <Checkbox
                                colorScheme="gray"
                                isIndeterminate={
                                    selectedResourceIdentifiers.length > 0 &&
                                    selectedResourceIdentifiers.length <
                                        sortedKeyedResources.length
                                }
                                isChecked={
                                    selectedResourceIdentifiers.length > 0 &&
                                    selectedResourceIdentifiers.length ===
                                        sortedKeyedResources.length
                                }
                                onChange={onChangeSelectAll}
                            />
                        </Th>
                        <Th ps={0}>Name</Th>
                        {showNamespace && <Th width="150px">Namespace</Th>}
                        <Th width="150px">Created</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {sortedKeyedResources.map(({ key, resource }, index) => (
                        <WorkloadResourceRow
                            resource={resource}
                            showNamespace={showNamespace}
                            key={key}
                            isSelected={selectedResourceIdentifiers.includes(
                                key
                            )}
                            onChangeSelect={onSelectHandlers[key]}
                        />
                    ))}
                </Tbody>
            </Table>
        );
    }
);

type WorkloadResourceRowProps = {
    resource: K8sObject;
    showNamespace: boolean;
    isSelected?: boolean;
    onChangeSelect?: (selected: boolean) => void;
};

const WorkloadResourceRow: React.FC<WorkloadResourceRowProps> = (props) => {
    const { resource, isSelected, onChangeSelect, showNamespace } = props;

    const creationDate = new Date((resource as any).metadata.creationTimestamp);
    const isDeleting = Boolean((resource as any).metadata.deletionTimestamp);

    const onChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            onChangeSelect?.(e.target.checked);
        },
        [onChangeSelect]
    );

    const badges: ResourceBadge[] = useMemo(
        () => generateBadges(resource),
        [resource]
    );

    return (
        <Tr>
            <Td ps={2} verticalAlign="baseline">
                <Checkbox
                    colorScheme="primary"
                    isChecked={isSelected}
                    onChange={onChange}
                />
            </Td>
            <Td ps={0} verticalAlign="baseline" userSelect="text">
                <HStack p={0}>
                    <Selectable
                        display="block"
                        cursor="inherit"
                        textColor={isDeleting ? "gray.500" : ""}
                        isTruncated
                    >
                        <ResourceEditorLink
                            userSelect="text"
                            editorResource={resource}
                        >
                            {resource.metadata.name}
                        </ResourceEditorLink>
                    </Selectable>
                    {badges.map((badge) => {
                        const { id, text, variant, details, badgeProps } =
                            badge;
                        const colorScheme = {
                            positive: "green",
                            negative: "red",
                            changing: "orange",
                            other: "gray",
                        }[variant ?? "other"];
                        return (
                            <Badge
                                key={id}
                                colorScheme={colorScheme}
                                title={details ?? text}
                                {...badgeProps}
                            >
                                {text}
                            </Badge>
                        );
                    })}
                </HStack>
            </Td>
            {showNamespace && (
                <Td verticalAlign="baseline">
                    <Selectable display="block" isTruncated>
                        {resource.metadata.namespace}
                    </Selectable>
                </Td>
            )}
            <Td verticalAlign="baseline">
                <Selectable display="block" isTruncated>
                    {formatDeveloperDateTime(creationDate)}
                </Selectable>
            </Td>
        </Tr>
    );
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
    const [helmGroups, remainingResources] = helmGroupResources(resources);
    const hasRemainingResources = Object.values(remainingResources).some(
        (g) => g.resources.length > 0
    );
    const groups = [...helmGroups];
    if (hasRemainingResources) {
        groups.push({
            id: "other",
            title: "Other",
            badges: [],
            resources: remainingResources,
        });
    }
    return groups;
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
                const match = chart.match(/^(.*)-(v?[0-9\.]+)$/);
                if (match) {
                    groupInfo[groupId].chart = match[1];
                    groupInfo[groupId].chartVersion = match[2];
                } else if (!groupInfo[groupId].chart) {
                    groupInfo[groupId].chart = chart;
                }
            }
            return groupId;
        } else if (
            resource.metadata.annotations?.["meta.helm.sh/release-namespace"] &&
            resource.metadata.annotations?.["meta.helm.sh/release-name"]
        ) {
            const namespace =
                resource.metadata.annotations["meta.helm.sh/release-namespace"];
            const instance =
                resource.metadata.annotations?.["meta.helm.sh/release-name"];
            if (!namespacesByInstance[instance]) {
                namespacesByInstance[instance] = {};
            }
            namespacesByInstance[instance][namespace] = namespace;
            const groupId = `${namespace}:${instance}`;

            if (!groupInfo[groupId]) {
                groupInfo[groupId] = { instance, namespace };
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

    const groupsBySecretId: Record<string, string> = {};
    for (const helmGroup of Object.values(helmGroups)) {
        for (const ingress of helmGroup.resources["ingresses"]?.resources ??
            []) {
            for (const tls of (ingress as any).spec?.tls ?? []) {
                if (tls.secretName) {
                    groupsBySecretId[
                        ingress.metadata.namespace + ":" + tls.secretName
                    ] = helmGroup.id;
                }
            }
        }
    }
    remainingResources["secrets"].resources = remainingResources[
        "secrets"
    ]?.resources.filter((secret) => {
        const id = secret.metadata.namespace + ":" + secret.metadata.name;
        if (groupsBySecretId[id]) {
            const helmGroupId = groupsBySecretId[id];
            helmGroups[helmGroupId].resources["secrets"].resources.push(secret);
            return false;
        }
        // Filter out Helm releases.
        if ((secret as any).type === "helm.sh/release.v1") {
            return false;
        }
        return true;
    });

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
            let text = `Chart: ${info.chart}`;
            if (info.chartVersion) {
                text += " " + info.chartVersion;
            }
            helmGroup.badges.push({
                id: "chart",
                text,
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

    const defaultSpecItems: Partial<K8sObjectListQuery> =
        namespaces.mode === "all" ? {} : { namespaces: namespaces.selected };
    const specs = {
        deployments: {
            apiVersion: "apps/v1",
            kind: "Deployment",
            ...defaultSpecItems,
        },
        statefulSets: {
            apiVersion: "apps/v1",
            kind: "StatefulSet",
            ...defaultSpecItems,
        },
        daemonSets: {
            apiVersion: "apps/v1",
            kind: "DaemonSet",
            ...defaultSpecItems,
        },
        services: {
            apiVersion: "v1",
            kind: "Service",
            ...defaultSpecItems,
        },
        configMaps: {
            apiVersion: "v1",
            kind: "ConfigMap",
            ...defaultSpecItems,
        },
        secrets: {
            apiVersion: "v1",
            kind: "Secret",
            ...defaultSpecItems,
        },
        ingresses: {
            apiVersion: "networking.k8s.io/v1",
            kind: "Ingress",
            ...defaultSpecItems,
        },
    };

    const results = useK8sListWatches(specs, listWatchOptions, [namespaces]);
    return useMemo(
        () =>
            Object.fromEntries(
                Object.entries(results).map(([k, result]) => [
                    k,
                    {
                        isLoading: result[0],
                        resources: result[1]?.items ?? [],
                        error: result[2],
                    },
                ])
            ),
        [results]
    );
}
