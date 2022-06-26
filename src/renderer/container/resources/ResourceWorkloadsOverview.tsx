import { ChevronDownIcon } from "@chakra-ui/icons";
import {
    Badge,
    Box,
    Button,
    Checkbox,
    Collapse,
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
import React, { ChangeEvent, useCallback, useEffect, useMemo } from "react";
import { K8sObject, K8sObjectListQuery } from "../../../common/k8s/client";
import { updateResourceListByVersion } from "../../../common/k8s/util";
import { k8sSmartCompare } from "../../../common/util/sort";
import { LazyComponent } from "../../component/main/LazyComponent";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import {
    K8sListWatchesListenerOptions,
    useK8sListWatchesListener,
} from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";
import { create } from "../../util/state";
import { ResourceEditorLink } from "./ResourceEditorLink";

type WorkloadsStore = {
    groups: Record<string, WorkloadResourceGroup>;
    groupSubResources: Record<string, K8sObject[]>;
    expandedGroups: Set<string>;
    allResourcesByType: Record<
        string,
        { isLoading: boolean; resources: K8sObject[]; error: undefined | any }
    >;
    showNamespace: boolean;
};

type WorkloadResourceGroup = {
    id: string;
    title: string;
    badges: ResourceBadge[];
    contains: (resource: K8sObject) => boolean;
};

const resourceTypes: Record<string, { title: string }> = {
    deployments: { title: "Deployments" },
    statefulSets: { title: "StatefulSets" },
    daemonSets: { title: "DaemonSets" },
    ingresses: { title: "Ingresses" },
    services: { title: "Services" },
    configMaps: { title: "ConfigMaps" },
    secrets: { title: "Secrets" },
};

const storeEmptyState: WorkloadsStore = {
    groups: {},
    groupSubResources: {},
    expandedGroups: new Set(),
    allResourcesByType: Object.fromEntries(
        Object.keys(resourceTypes).map((k) => [
            k,
            { isLoading: true, resources: [], error: undefined },
        ])
    ),
    showNamespace: false,
};

const { useStore, useStoreValue, store } = create(storeEmptyState);
store.subscribe((value) => {
    console.log("store", { isEmpty: value === storeEmptyState, value });
});

export const ResourceWorkloadsOverview: React.FC<{}> = () => {
    const groups = useStoreValue((value) => value.groups);
    console.log("render root", groups);

    return (
        <ScrollBox px={4} py={2} flex="1 0 0">
            <WorkloadsMonitor />
            <GroupedResourcesOverview />
        </ScrollBox>
    );
};

// Empty component so we can run the hook without rerendering everything.
export const WorkloadsMonitor: React.FC<{}> = () => {
    useMonitorWorkloads();
    return null;
};

function useMonitorWorkloads() {
    const namespaces = useK8sNamespaces();

    const store = useStore();

    useEffect(() => {
        store.set({
            ...storeEmptyState,
            showNamespace:
                namespaces.mode === "all" || namespaces.selected.length > 1,
        });
    }, [namespaces, store]);

    const listWatchOptions: K8sListWatchesListenerOptions = useMemo(
        () => ({
            onUpdate(messages) {
                store.set((oldValue) => {
                    const newValue = {
                        ...oldValue,
                        allResourcesByType: { ...oldValue.allResourcesByType },
                    };
                    for (const [k, message] of Object.entries(messages)) {
                        newValue.allResourcesByType[k] = {
                            isLoading: false,
                            resources: message.list.items,
                            error: undefined,
                        };
                    }

                    // Now find the groups.
                    const allResources: K8sObject[] = [];
                    for (const info of Object.values(
                        newValue.allResourcesByType
                    )) {
                        allResources.push(...info.resources);
                    }
                    const orderedGroups = computeGroups(allResources);
                    const groups = Object.fromEntries(
                        orderedGroups.map((g) => [g.id, g])
                    );
                    let newGroups = oldValue.groups;
                    for (const group of Object.values(groups)) {
                        if (!newGroups[group.id]) {
                            // Add group.
                            newGroups = { ...newGroups, [group.id]: group };
                        }
                    }
                    for (const oldGroupId of Object.keys(oldValue.groups)) {
                        if (!groups[oldGroupId]) {
                            // Remove group.
                            newGroups = { ...newGroups };
                            delete newGroups[oldGroupId];
                        }
                    }
                    newValue.groups = newGroups;

                    // Now group the updated resources with the new groups.
                    const newGroupSubResources: Record<string, K8sObject[]> =
                        {};
                    for (const [type, typeResources] of Object.entries(
                        newValue.allResourcesByType
                    )) {
                        for (const resource of typeResources.resources) {
                            const group = orderedGroups.find((group) =>
                                group.contains(resource)
                            );
                            const subResourcesKey = `${
                                group?.id ?? ""
                            }:${type}`;
                            if (!newGroupSubResources[subResourcesKey]) {
                                newGroupSubResources[subResourcesKey] = [];
                            }
                            newGroupSubResources[subResourcesKey].push(
                                resource
                            );
                        }
                    }
                    newValue.groupSubResources = Object.fromEntries(
                        Object.entries(newGroupSubResources).map(
                            ([key, resources]) => {
                                return [
                                    key,
                                    updateResourceListByVersion(
                                        oldValue.groupSubResources[key] ?? [],
                                        resources
                                    ),
                                ];
                            }
                        )
                    );

                    return newValue;
                });
            },
            onWatchError(key, error) {
                store.set((oldValue) => ({
                    ...oldValue,
                    allResourcesByType: {
                        ...oldValue.allResourcesByType,
                        [key]: { isLoading: false, resources: [], error },
                    },
                }));
            },
            updateCoalesceInterval: 1000,
        }),
        [store]
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

    useK8sListWatchesListener(specs, listWatchOptions, [namespaces]);
}

function computeGroups(resources: K8sObject[]): WorkloadResourceGroup[] {
    const allGroups = [
        ...computeHelmGroups(resources),
        {
            id: "_",
            title: "Uncategorized",
            badges: [],
            contains: () => true,
        },
    ];
    let remainingResources: K8sObject[] = resources;
    const necessaryGroups = allGroups.filter((group) => {
        const newRemainingResources: K8sObject[] = [];
        let groupIsNonEmpty = false;
        for (const resource of remainingResources) {
            if (group.contains(resource)) {
                groupIsNonEmpty = true;
            } else {
                newRemainingResources.push(resource);
            }
        }
        remainingResources = newRemainingResources;
        return groupIsNonEmpty;
    });
    return necessaryGroups;
}

function computeHelmGroups(resources: K8sObject[]): WorkloadResourceGroup[] {
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

    for (const resource of resources) {
        findHelmGroup(resource);
    }

    return Object.entries(groupInfo).map(([id, info]) => {
        let title = info.instance;
        let badges: ResourceBadge[] = [];
        if (
            namespacesByInstance[info.instance] &&
            Object.values(namespacesByInstance[info.instance]).length > 1
        ) {
            title = `${info.instance} (${info.namespace})`;
        }
        if (info.chart) {
            let text = `Chart: ${info.chart}`;
            if (info.chartVersion) {
                text += " " + info.chartVersion;
            }
            badges.push({
                id: "chart",
                text,
                variant: "other",
            });
        }
        return {
            id,
            title,
            badges,
            contains(resource) {
                return findHelmGroup(resource) === id;
            },
        };
    });
}

const GroupedResourcesOverview: React.FC<{}> = (props) => {
    const groups = useStoreValue((value) => value.groups);

    const sortedGroups = useMemo(() => {
        let otherGroup: WorkloadResourceGroup | undefined;
        const namedGroups = Object.values(groups).filter((g) => {
            if (g.id === "_") {
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

    return (
        <VStack alignItems="stretch" spacing={2}>
            {sortedGroups.map((group) => (
                <WorkloadGroup groupId={group.id} key={group.id} />
            ))}
        </VStack>
    );
};

const WorkloadGroup: React.FC<{
    groupId: string;
}> = (props) => {
    const { groupId } = props;

    const group = useStoreValue((value) => value.groups[groupId], [groupId]);
    const showNamespace = useStoreValue((value) => value.showNamespace);

    const groupEdgeBg = useColorModeValue("gray.100", "gray.700");
    const groupContentBg = useColorModeValue("white", "gray.900");
    const headingColor = useColorModeValue("primary.500", "primary.400");

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const metaKeyRef = useModifierKeyRef("Meta");

    const expandedParamName = "workloadGroupsExpanded";
    const isExpanded = useAppRoute(
        (route) =>
            ((route.params?.[expandedParamName] ?? []) as string[]).includes(
                groupId
            ),
        [groupId]
    );
    const toggleExpanded = useCallback(() => {
        const route = getAppRoute();
        const expandedIds = (route.params?.[expandedParamName] ??
            []) as string[];
        const prevExpanded = expandedIds.includes(groupId);
        const newExpandedIds = prevExpanded
            ? expandedIds.filter((id) => id !== groupId)
            : [...expandedIds, groupId];
        const newRoute = {
            ...route,
            params: {
                ...route.params,
                [expandedParamName]: newExpandedIds,
            },
        };
        if (metaKeyRef.current) {
            createWindow({
                route: newRoute,
            });
        } else {
            setAppRoute(() => newRoute, true);
        }
    }, [createWindow, groupId, isExpanded, metaKeyRef, setAppRoute]);

    return (
        <VStack
            key={group.id}
            bg={groupEdgeBg}
            alignItems="stretch"
            borderRadius={12}
            p={2}
            maxWidth="1000px"
        >
            <Box>
                <Button
                    w="100%"
                    px={4}
                    py={2}
                    bg="transparent"
                    h="auto"
                    justifyContent="start"
                    fontSize="xs"
                    fontWeight="semibold"
                    textColor={headingColor}
                    textTransform="uppercase"
                    onClick={toggleExpanded}
                    leftIcon={
                        <ChevronDownIcon
                            transition="500ms transform"
                            transform={
                                isExpanded ? "rotate(0deg)" : "rotate(180deg)"
                            }
                        />
                    }
                >
                    {group.title}
                </Button>
            </Box>
            <Collapse animateOpacity in={isExpanded}>
                <LazyComponent isActive={isExpanded}>
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
                        {Object.entries(resourceTypes).map(([k, { title }]) => (
                            <WorkloadResourceSection
                                key={k}
                                typeKey={k}
                                title={title}
                                showNamespace={showNamespace}
                                groupId={group.id}
                            />
                        ))}
                    </VStack>
                </LazyComponent>
            </Collapse>
        </VStack>
    );
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

type WorkloadResourceSectionProps = {
    title: string;
    showNamespace: boolean;
    typeKey: string;
    groupId: string;
};

const emptyResourcesList: K8sObject[] = [];

const WorkloadResourceSection: React.FC<WorkloadResourceSectionProps> = (
    props
) => {
    const { title, showNamespace, typeKey, groupId } = props;

    const isLoading = useStoreValue(
        (value) => value.allResourcesByType[typeKey]?.isLoading ?? true,
        [typeKey]
    );
    const resources = useStoreValue(
        (value) =>
            value.groupSubResources[`${groupId}:${typeKey}`] ??
            emptyResourcesList,
        [groupId, typeKey]
    );

    return (
        <VStack alignItems="stretch">
            <Heading fontSize="sm">{title}</Heading>
            {isLoading && <Spinner size="sm" ps={4} />}
            {!isLoading && resources.length > 0 && (
                <WorkloadResourceList
                    showNamespace={showNamespace}
                    resources={resources}
                />
            )}
            {!isLoading && resources.length === 0 && (
                <Text textColor="gray" fontSize="sm">
                    None
                </Text>
            )}
        </VStack>
    );
};

type WorkloadResourceListProps = {
    resources: K8sObject[];
    showNamespace: boolean;
};

const WorkloadResourceList: React.FC<WorkloadResourceListProps> = (props) => {
    const { resources, showNamespace } = props;

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
    // TODO!
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
        []
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
                {sortedKeyedResources.map(({ key, resource }) => (
                    <WorkloadResourceRow
                        resource={resource}
                        showNamespace={showNamespace}
                        key={key}
                        isSelected={selectedResourceIdentifiers.includes(key)}
                        onChangeSelect={onSelectHandlers[key]}
                    />
                ))}
            </Tbody>
        </Table>
    );
};

type WorkloadResourceRowProps = {
    resource: K8sObject;
    showNamespace: boolean;
    isSelected?: boolean;
    onChangeSelect?: (selected: boolean) => void;
};

const WorkloadResourceRow: React.FC<WorkloadResourceRowProps> = (props) => {
    const { resource, isSelected, onChangeSelect, showNamespace } = props;
    counter++;

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
