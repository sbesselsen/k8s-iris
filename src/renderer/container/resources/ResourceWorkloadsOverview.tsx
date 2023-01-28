import { ChevronDownIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    Collapse,
    Heading,
    HStack,
    Spinner,
    Text,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useMemo } from "react";
import { K8sResourceTypeIdentifier } from "../../../common/k8s/client";
import { reuseShallowEqualObject } from "../../../common/util/deep-equal";
import {
    BatchGrouping,
    combineGroupings,
    createGroupProcessor,
} from "../../../common/util/group";
import { searchMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { LazyComponent } from "../../component/main/LazyComponent";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import {
    K8sListWatchStoreValue,
    useK8sListWatchStore,
} from "../../k8s/list-watch";
import {
    basicGroup,
    basicPostGroup,
    helmGroup,
    ResourceGroup,
} from "../../k8s/resource-group";
import {
    create,
    useDerivedReadableStore,
    useProvidedStoreValue,
} from "../../util/state";
import { ResourceContextMenu } from "./ResourceContextMenu";
import { ResourcesTable, ResourcesTableStoreValue } from "./ResourcesTable";
import { ResourcesToolbar } from "./ResourcesToolbar";

type WorkloadsStoreValue = BatchGrouping<ResourceGroup> &
    K8sListWatchStoreValue & {
        selectedResourceKeys: Set<string>;
        showNamespace: boolean;
        shouldDefaultExpandGroups: boolean;
    };

const resourceTypes: Record<
    string,
    { title: string } & K8sResourceTypeIdentifier
> = {
    deployments: {
        title: "Deployments",
        apiVersion: "apps/v1",
        kind: "Deployment",
    },
    statefulSets: {
        title: "Stateful sets",
        apiVersion: "apps/v1",
        kind: "StatefulSet",
    },
    daemonSets: {
        title: "Daemonsets",
        apiVersion: "apps/v1",
        kind: "DaemonSet",
    },
    cronJobs: {
        title: "Cronjobs",
        apiVersion: "batch/v1",
        kind: "CronJob",
    },
    persistentVolumeClaims: {
        title: "Persistent volume claims",
        apiVersion: "v1",
        kind: "PersistentVolumeClaim",
    },
    ingresses: {
        title: "Ingresses",
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
    },
    services: { title: "Services", apiVersion: "v1", kind: "Service" },
    configMaps: { title: "Configmaps", apiVersion: "v1", kind: "ConfigMap" },
    secrets: { title: "Secrets", apiVersion: "v1", kind: "Secret" },
};

const storeEmptyState: WorkloadsStoreValue = {
    isLoading: true,
    identifiers: new Set(),
    resources: {},
    groups: {},
    members: {},
    ungroupedItems: new Set(),
    selectedResourceKeys: new Set(),
    showNamespace: false,
    shouldDefaultExpandGroups: false,
};

const otherGroup: ResourceGroup = {
    id: "_",
    title: "Other",
    sortOrder: 105,
    shouldDefaultExpand: false,
};

const { useStore, useStoreValue, store } = create(storeEmptyState);
// store.subscribe((value) => {
//     console.log("store", value);
// });

export const ResourceWorkloadsOverview: React.FC<{}> = () => {
    useMonitorWorkloads();

    return (
        <VStack
            flex="1 0 0"
            alignItems="stretch"
            position="relative"
            spacing={0}
        >
            <ResourceWorkloadsSpinner />
            <ScrollBox
                flex="1 0 0"
                attachedToolbar={<ResourceWorkloadsToolbar />}
            >
                <GroupedResourcesOverview />
            </ScrollBox>
        </VStack>
    );
};

const ResourceWorkloadsSpinner: React.FC<{}> = () => {
    const isLoading = useStoreValue((v) => v.isLoading);
    if (!isLoading) {
        return null;
    }
    return (
        <Box
            position="absolute"
            pointerEvents="none"
            right={6}
            bottom={4}
            zIndex={2}
        >
            <Spinner size="md" label="Loading all workloads..." />
        </Box>
    );
};

export const ResourceWorkloadsToolbar: React.FC<{}> = () => {
    const resources = useStoreValue(({ selectedResourceKeys, resources }) =>
        [...selectedResourceKeys]
            .map((key) => resources[key])
            .filter((x) => x !== undefined)
    );

    const store = useStore();
    const onClearSelection = useCallback(() => {
        store.set((oldValue) => ({
            ...oldValue,
            selectedResourceKeys: new Set(),
        }));
    }, [store]);

    return (
        <ResourcesToolbar
            resources={resources}
            onClearSelection={onClearSelection}
        />
    );
};

function useMonitorWorkloads() {
    const namespaces = useK8sNamespaces();

    const specs = useMemo(
        () =>
            Object.values(resourceTypes).map(({ apiVersion, kind }) => ({
                apiVersion,
                kind,
                ...(namespaces.mode === "all"
                    ? {}
                    : { namespaces: namespaces.selected }),
            })),
        [namespaces]
    );

    const resourcesStore = useK8sListWatchStore(
        specs,
        {
            updateCoalesceInterval: 100,
            onWatchError(error) {
                console.error("Watch error: ", error);
            },
        },
        [specs]
    );

    const groupProcessor = useMemo(
        () =>
            createGroupProcessor(
                combineGroupings(helmGroup, basicGroup),
                basicPostGroup
            ),
        []
    );

    const applyValue = useCallback(
        (oldValue: WorkloadsStoreValue, resources: K8sListWatchStoreValue) => {
            const newValue = { ...oldValue };

            newValue.isLoading = resources.isLoading;
            newValue.identifiers = resources.identifiers;
            newValue.resources = resources.resources;
            newValue.showNamespace =
                namespaces.mode === "all" || namespaces.selected.length > 1;
            newValue.shouldDefaultExpandGroups =
                namespaces.mode === "selected" &&
                namespaces.selected.length <= 1;

            const { groups, members, ungroupedItems } = groupProcessor(
                resources.resources,
                true
            );

            newValue.groups = groups;
            newValue.members = members;
            newValue.ungroupedItems = ungroupedItems;

            return reuseShallowEqualObject(newValue, oldValue);
        },
        [groupProcessor, namespaces]
    );

    const store = useStore();
    useEffect(() => {
        function listener(resources: K8sListWatchStoreValue) {
            store.set((oldValue) => applyValue(oldValue, resources));
        }
        listener(resourcesStore.get());
        resourcesStore.subscribe(listener);
        return () => {
            resourcesStore.unsubscribe(listener);
        };
    }, [resourcesStore, store]);
}

const GroupedResourcesOverview: React.FC<{}> = () => {
    const groups = useStoreValue((value) => value.groups);
    const hasUngrouped = useStoreValue(
        (value) => value.ungroupedItems.size > 0
    );
    const isLoading = useStoreValue((value) => value.isLoading);

    const fullGroupsList: ResourceGroup[] = useMemo(() => {
        if (hasUngrouped) {
            return [...Object.values(groups), otherGroup];
        }
        return Object.values(groups);
    }, [groups, hasUngrouped]);

    const groupTitlesCount = useMemo(() => {
        const count: Record<string, number> = {};
        for (const group of fullGroupsList) {
            count[group.title] = (count[group.title] ?? 0) + 1;
        }
        return count;
    }, [fullGroupsList]);

    const sortedGroups = useMemo(
        () =>
            fullGroupsList.sort((a, b) => {
                const aSortOrder = a.sortOrder ?? 0;
                const bSortOrder = b.sortOrder ?? 0;
                if (aSortOrder !== bSortOrder) {
                    return aSortOrder - bSortOrder;
                }
                return k8sSmartCompare(a.title, b.title);
            }),
        [fullGroupsList]
    );

    const { query } = useAppSearch();

    const filteredGroups = useMemo(
        () =>
            query
                ? sortedGroups.filter((group) =>
                      searchMatch(query, group.title)
                  )
                : sortedGroups,
        [sortedGroups, query]
    );

    const getSelectedObjects = useCallback(() => {
        const { selectedResourceKeys, resources } = store.get();
        return [...selectedResourceKeys]
            .map((key) => resources[key])
            .filter((x) => x !== undefined);
    }, [store]);

    return (
        <ResourceContextMenu objects={getSelectedObjects}>
            <VStack alignItems="stretch" spacing={2}>
                {filteredGroups.map((group) => (
                    <WorkloadGroup
                        qualifyTitle={(groupTitlesCount[group.title] ?? 1) > 1}
                        groupId={group.id}
                        key={group.id}
                    />
                ))}
                {filteredGroups.length === 0 && !isLoading && (
                    <Box>
                        <Text color="gray">No workloads selected.</Text>
                    </Box>
                )}
            </VStack>
        </ResourceContextMenu>
    );
};

const WorkloadGroup: React.FC<{
    groupId: string;
    qualifyTitle: boolean;
}> = (props) => {
    const { groupId, qualifyTitle } = props;

    const shouldDefaultExpandGroups = useStoreValue(
        (value) => value.shouldDefaultExpandGroups
    );
    const group = useStoreValue(
        (value) =>
            groupId === otherGroup.id ? otherGroup : value.groups[groupId],
        [groupId]
    );
    const showNamespace = useStoreValue((value) => value.showNamespace);

    const groupEdgeBg = useColorModeValue("gray.100", "gray.800");
    const groupContentBg = useColorModeValue("white", "gray.900");
    const headingColor = useColorModeValue("black", "white");

    const store = useStore();
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const metaKeyRef = useModifierKeyRef("Meta");

    const expandedParamName = "workloadGroupsExpanded";

    const shouldDefaultExpand =
        shouldDefaultExpandGroups && group.shouldDefaultExpand;
    const isExpanded = useAppRoute(
        (route) =>
            (route.params?.[expandedParamName] as any)?.[groupId] ??
            shouldDefaultExpand,
        [groupId, shouldDefaultExpand]
    );
    const toggleExpanded = useCallback(() => {
        const route = getAppRoute();
        const expanded = (route.params?.[expandedParamName] ?? {}) as Record<
            string,
            boolean
        >;
        const prevExpanded = expanded[groupId] ?? shouldDefaultExpand;
        const newExpanded = { ...expanded, [groupId]: !prevExpanded };

        const storeValue = store.get();
        if (storeValue.shouldDefaultExpandGroups) {
            // Disable auto-expanding, but first explicitly expand all currently auto-expanded groups.
            for (const group of Object.values(storeValue.groups).filter(
                (g) => g.shouldDefaultExpand && g.id !== groupId
            )) {
                newExpanded[group.id] = true;
            }
            store.set((v) => ({ ...v, shouldDefaultExpandGroups: false }));
        }

        if (metaKeyRef.current) {
            // Show a new window with only this group expanded.
            createWindow({
                route: {
                    ...route,
                    params: {
                        ...route.params,
                        [expandedParamName]: {
                            ...Object.fromEntries(
                                Object.values(storeValue.groups).map((g) => [
                                    g.id,
                                    false,
                                ])
                            ),
                            [groupId]: true,
                        },
                    },
                },
            });
        } else {
            setAppRoute(
                (route) => ({
                    ...route,
                    params: {
                        ...route.params,
                        [expandedParamName]: newExpanded,
                    },
                }),
                true
            );
        }
    }, [
        createWindow,
        groupId,
        metaKeyRef,
        setAppRoute,
        shouldDefaultExpand,
        store,
    ]);

    if (!group) {
        return null;
    }

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
                    colorScheme="gray"
                    justifyContent="start"
                    fontSize="xs"
                    fontWeight="semibold"
                    textColor={headingColor}
                    textTransform="uppercase"
                    variant="ghost"
                    onClick={toggleExpanded}
                    leftIcon={
                        <ChevronDownIcon
                            transition="300ms transform"
                            w="1rem"
                            h="1rem"
                            transform={
                                isExpanded ? "rotate(-180deg)" : "rotate(0deg)"
                            }
                        />
                    }
                >
                    {group.title}
                    {qualifyTitle && group.titleQualifier
                        ? ` (${group.titleQualifier})`
                        : ""}
                </Button>
            </Box>
            <Collapse animateOpacity in={isExpanded}>
                <LazyComponent isActive={isExpanded}>
                    <VStack
                        alignItems="stretch"
                        bg={groupContentBg}
                        borderRadius={6}
                        spacing={4}
                        py={4}
                    >
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

type WorkloadResourceSectionProps = {
    title: string;
    showNamespace: boolean;
    typeKey: string;
    groupId: string;
};

const emptyStringSet: Set<string> = new Set();

const WorkloadResourceSection: React.FC<WorkloadResourceSectionProps> =
    React.memo((props) => {
        const { title, showNamespace, typeKey, groupId } = props;
        const store = useStore();

        const onChangeSelectedKeys = useCallback(
            (keys: Record<string, boolean>) => {
                store.set((oldValue) => {
                    let isUpdated = false;
                    const selectedResourceKeys = new Set(
                        oldValue.selectedResourceKeys
                    );
                    for (const [k, v] of Object.entries(keys)) {
                        if (v !== selectedResourceKeys.has(k)) {
                            isUpdated = true;
                        }
                        if (v) {
                            selectedResourceKeys.add(k);
                        } else {
                            selectedResourceKeys.delete(k);
                        }
                    }
                    return isUpdated
                        ? { ...oldValue, selectedResourceKeys }
                        : oldValue;
                });
            },
            [store]
        );

        const resourcesStore = useDerivedReadableStore<
            WorkloadsStoreValue,
            ResourcesTableStoreValue
        >(
            store,
            (workloadsValue, prevWorkloadsValue, prevTableValue) => {
                const { apiVersion, kind } = resourceTypes[typeKey];

                function getGroupResourceKeys(
                    workloads: WorkloadsStoreValue,
                    groupId: string
                ) {
                    return groupId === otherGroup.id
                        ? workloads.ungroupedItems
                        : workloads.members[groupId] ?? emptyStringSet;
                }
                const groupResourceKeys = getGroupResourceKeys(
                    workloadsValue,
                    groupId
                );

                const resources = workloadsValue.resources;

                if (
                    prevTableValue &&
                    prevWorkloadsValue &&
                    getGroupResourceKeys(prevWorkloadsValue, groupId) ===
                        groupResourceKeys
                ) {
                    // Resource keys for this group have remained the same.
                    // Since resources never change type, we don't have to reclassify all resources.
                    return {
                        identifiers: prevTableValue.identifiers,
                        resources,
                    };
                }

                const identifiers: Set<string> = new Set(
                    [...groupResourceKeys].filter((key) => {
                        const resource = resources[key];
                        return (
                            resource.apiVersion === apiVersion &&
                            resource.kind === kind
                        );
                    })
                );

                return { identifiers, resources };
            },
            [typeKey]
        );

        const selectedKeysStore = useDerivedReadableStore<
            WorkloadsStoreValue,
            Set<string>
        >(store, ({ selectedResourceKeys }) => selectedResourceKeys);

        const hasResources = useProvidedStoreValue(
            resourcesStore,
            (v) => v.identifiers.size > 0
        );
        if (!hasResources) {
            return null;
        }

        return (
            <VStack alignItems="stretch">
                <Heading fontSize="sm" px={4}>
                    {title}
                </Heading>
                <ResourcesTable
                    showNamespace={showNamespace}
                    onChangeSelectedKeys={onChangeSelectedKeys}
                    selectedKeysStore={selectedKeysStore}
                    resourcesStore={resourcesStore}
                />
            </VStack>
        );
    });
