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
    TableCellProps,
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
import {
    K8sObject,
    K8sObjectIdentifier,
    K8sObjectListQuery,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../../common/k8s/util";
import {
    reuseShallowEqualObject,
    shallowEqualWrap,
} from "../../../common/util/deep-equal";
import {
    BatchGrouping,
    combineGroupings,
    createGroupProcessor,
} from "../../../common/util/group";
import { searchMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { LazyComponent } from "../../component/main/LazyComponent";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import {
    generateResourceDetails,
    isResourceBox,
    isResourceColumn,
    ResourceColumn,
    ResourceDetail,
} from "../../k8s/details";
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
import { formatDeveloperDateTime } from "../../util/date";
import { create } from "../../util/state";
import { ResourceContextMenu } from "./ResourceContextMenu";
import { ResourceEditorLink } from "./ResourceEditorLink";
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
        title: "StatefulSets",
        apiVersion: "apps/v1",
        kind: "StatefulSet",
    },
    daemonSets: {
        title: "DaemonSets",
        apiVersion: "apps/v1",
        kind: "DaemonSet",
    },
    persistentVolumeClaims: {
        title: "Persistent Volume Claims",
        apiVersion: "v1",
        kind: "PersistentVolumeClaim",
    },
    ingresses: {
        title: "Ingresses",
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
    },
    services: { title: "Services", apiVersion: "v1", kind: "Service" },
    configMaps: { title: "ConfigMaps", apiVersion: "v1", kind: "ConfigMap" },
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
store.subscribe((value) => {
    //console.log("store", value);
});

export const ResourceWorkloadsOverview: React.FC<{}> = () => {
    useMonitorWorkloads();

    return (
        <ScrollBox flex="1 0 0" attachedToolbar={<ResourceWorkloadsToolbar />}>
            <GroupedResourcesOverview />
        </ScrollBox>
    );
};

export const ResourceWorkloadsToolbar: React.FC<{}> = () => {
    const store = useStore();

    // TODO!

    return (
        <ResourcesToolbar resources={undefined} onClearSelection={undefined} />
    );
};

function useMonitorWorkloads() {
    const namespaces = useK8sNamespaces();

    const defaultSpecItems: Partial<K8sObjectListQuery> = useMemo(
        () =>
            namespaces.mode === "all"
                ? {}
                : { namespaces: namespaces.selected },
        [namespaces]
    );

    const specs = useMemo(
        () =>
            Object.values(resourceTypes).map(({ apiVersion, kind }) => ({
                apiVersion,
                kind,
                ...defaultSpecItems,
            })),
        [defaultSpecItems]
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

            const ts = new Date().getTime();
            const { groups, members, ungroupedItems } = groupProcessor(
                resources.resources,
                true
            );
            console.log("group calc", new Date().getTime() - ts);

            newValue.groups = groups;
            newValue.members = members;
            newValue.ungroupedItems = ungroupedItems;

            return reuseShallowEqualObject(oldValue, newValue);
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
    // TODO
}

const GroupedResourcesOverview: React.FC<{}> = () => {
    const groups = useStoreValue((value) => value.groups);
    const hasUngrouped = useStoreValue(
        (value) => value.ungroupedItems.size > 0
    );
    const isLoading = useStoreValue((value) => value.isLoading);

    // TODO: two groups with the same name in different namespaces should have a suffix
    const fullGroupsList: ResourceGroup[] = useMemo(() => {
        if (hasUngrouped) {
            return [...Object.values(groups), otherGroup];
        }
        return Object.values(groups);
    }, [groups, hasUngrouped]);

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
        // TODO
        return [];
        // const { selectedResourceKeys, allResourcesByType } = store.get();
        // return Object.values(allResourcesByType).flatMap((group) =>
        //     group.resources.filter((r) =>
        //         selectedResourceKeys.has(toK8sObjectIdentifierString(r))
        //     )
        // );
    }, [store]);

    return (
        <ResourceContextMenu objects={getSelectedObjects}>
            <VStack alignItems="stretch" spacing={2}>
                {filteredGroups.map((group) => (
                    <WorkloadGroup groupId={group.id} key={group.id} />
                ))}
                {filteredGroups.length === 0 && !isLoading && (
                    <Box>
                        <Text color="gray">No workloads selected.</Text>
                    </Box>
                )}
                {isLoading && (
                    <HStack justifyContent="center" py={10}>
                        <Spinner />
                    </HStack>
                )}
            </VStack>
        </ResourceContextMenu>
    );
};

const WorkloadGroup: React.FC<{
    groupId: string;
}> = (props) => {
    const { groupId } = props;

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

const WorkloadResourceSection: React.FC<WorkloadResourceSectionProps> =
    React.memo((props) => {
        const { title, showNamespace, typeKey, groupId } = props;

        const resources = useStoreValue(
            shallowEqualWrap((workloads) => {
                // TODO: this still runs on every group whenever a group changes. That should be unnecessary
                const groupResourcesKeysSet =
                    groupId === otherGroup.id
                        ? workloads.ungroupedItems
                        : workloads.members[groupId] ?? new Set();
                const groupResources = [...groupResourcesKeysSet].map(
                    (key) => workloads.resources[key]
                );
                if (groupId === "_") {
                    console.log(groupResources.length);
                }
                // Now filter these resources by type.
                const { apiVersion, kind } = resourceTypes[typeKey];
                return groupResources.filter(
                    (res) => res.apiVersion === apiVersion && res.kind === kind
                );
            }),
            [groupId, typeKey]
        );

        if (resources.length === 0) {
            return null;
        }

        return (
            <VStack alignItems="stretch">
                <Heading fontSize="sm" px={4}>
                    {title}
                </Heading>
                <WorkloadResourceList
                    showNamespace={showNamespace}
                    resources={resources}
                />
            </VStack>
        );
    });

type WorkloadResourceListProps = {
    resources: K8sObject[];
    showNamespace: boolean;
};

const WorkloadResourceList: React.FC<WorkloadResourceListProps> = (props) => {
    const { resources, showNamespace } = props;

    const store = useStore();
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

    const resourceKeysSet = useMemo(
        () => new Set(resources.map((r) => toK8sObjectIdentifierString(r))),
        [resources]
    );

    const numListedResourcesSelected = useStoreValue(
        (value) =>
            [...value.selectedResourceKeys].filter((key) =>
                resourceKeysSet.has(key)
            ).length,
        [resourceKeysSet]
    );
    const allResourcesSelected =
        numListedResourcesSelected > 0 &&
        numListedResourcesSelected === resources.length;
    const someResourcesSelected =
        numListedResourcesSelected > 0 &&
        numListedResourcesSelected < resources.length;

    const onChangeSelectAll = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const checked = e.target.checked;
            store.set((value) => {
                const newSelectedResourceKeys = new Set(
                    value.selectedResourceKeys
                );
                if (checked) {
                    for (const key of resourceKeysSet) {
                        newSelectedResourceKeys.add(key);
                    }
                } else {
                    for (const key of resourceKeysSet) {
                        newSelectedResourceKeys.delete(key);
                    }
                }
                return {
                    ...value,
                    selectedResourceKeys: newSelectedResourceKeys,
                };
            });
        },
        [resourceKeysSet, store]
    );

    // TODO: make all this into a nice hook or whatever
    const resourceTypesString = [
        ...new Set(resources.map((r) => `${r.apiVersion}:${r.kind}`)),
    ]
        .sort()
        .join(",");

    // Bit weird but it prevents unnecessary rerenders of the columns and, well, why not.
    const resourceTypes: K8sResourceTypeIdentifier[] = useMemo(
        () =>
            resourceTypesString.split(",").map((t) => {
                const [apiVersion, kind] = t.split(":");
                return { apiVersion, kind };
            }),
        [resourceTypesString]
    );

    const customDetails = useMemo(
        () => resourceTypes.flatMap((type) => generateResourceDetails(type)),
        [resourceTypes]
    );
    const customColumns = useMemo(
        () => customDetails.filter(isResourceColumn),
        [customDetails]
    );

    function detailColWidth(col: ResourceColumn): number {
        return 40 * (col.widthUnits + 1);
    }

    const detailColumns = customDetails.filter(isResourceColumn);
    const detailColumnsTotalWidth = detailColumns
        .map(detailColWidth)
        .reduce((x, y) => x + y, 0);

    return (
        <Box overflowX="auto" mx={-4} px={4}>
            <Table
                size="sm"
                sx={{ tableLayout: "fixed" }}
                minWidth={
                    350 +
                    (showNamespace ? 150 : 0) +
                    detailColumnsTotalWidth +
                    "px"
                }
            >
                <Thead>
                    <Tr>
                        <Th ps={2} width="40px">
                            <Checkbox
                                colorScheme="gray"
                                isIndeterminate={someResourcesSelected}
                                isChecked={allResourcesSelected}
                                onChange={onChangeSelectAll}
                            />
                        </Th>
                        <Th ps={0} whiteSpace="nowrap">
                            Name
                        </Th>
                        {customColumns.map((col) => (
                            <Th key={col.id} width={detailColWidth(col) + "px"}>
                                {col.header}
                            </Th>
                        ))}
                        {showNamespace && <Th width="150px">Namespace</Th>}
                        <Th width="120px">Created</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {sortedKeyedResources.map(({ key, resource }) => (
                        <WorkloadResourceRow
                            resource={resource}
                            showNamespace={showNamespace}
                            customDetails={customDetails}
                            key={key}
                        />
                    ))}
                </Tbody>
            </Table>
        </Box>
    );
};

type WorkloadResourceRowProps = {
    resource: K8sObject;
    showNamespace: boolean;
    customDetails: ResourceDetail[];
};

const WorkloadResourceRow: React.FC<WorkloadResourceRowProps> = (props) => {
    const { resource, showNamespace, customDetails } = props;

    const store = useStore();
    const creationDate = new Date((resource as any).metadata.creationTimestamp);
    const isDeleting = Boolean((resource as any).metadata.deletionTimestamp);

    const resourceKey = useMemo(
        () => toK8sObjectIdentifierString(resource),
        [resource]
    );
    const isSelected = useStoreValue(
        (value) => value.selectedResourceKeys.has(resourceKey),
        [resourceKey]
    );
    const onChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const selected = e.target.checked;
            store.set((value) => {
                const prevSelected =
                    value.selectedResourceKeys.has(resourceKey);
                let newSelectedResourceKeys = value.selectedResourceKeys;
                if (selected && !prevSelected) {
                    newSelectedResourceKeys = new Set(
                        value.selectedResourceKeys
                    );
                    newSelectedResourceKeys.add(resourceKey);
                } else {
                    newSelectedResourceKeys = new Set(
                        value.selectedResourceKeys
                    );
                    newSelectedResourceKeys.delete(resourceKey);
                }
                if (newSelectedResourceKeys !== value.selectedResourceKeys) {
                    return {
                        ...value,
                        selectedResourceKeys: newSelectedResourceKeys,
                    };
                }
                return value;
            });
        },
        [resourceKey, store]
    );

    const badges: ResourceBadge[] = useMemo(
        () => generateBadges(resource),
        [resource]
    );

    const customBoxes = useMemo(
        () =>
            customDetails
                .filter(isResourceBox)
                .map((box) => ({ ...box, value: box.valueFor(resource) }))
                .filter((v) => !!v.value),
        [customDetails, resource]
    );
    const hasCustomBoxes = customBoxes.length > 0;
    const commonTdProps: TableCellProps = useMemo(() => {
        return {
            ...(hasCustomBoxes ? { borderBottom: "none" } : {}),
        };
    }, [hasCustomBoxes]);
    const customColumns = customDetails.filter(isResourceColumn);

    return (
        <>
            <Tr>
                <Td {...commonTdProps} ps={2} verticalAlign="baseline">
                    <Checkbox isChecked={isSelected} onChange={onChange} />
                </Td>
                <Td
                    {...commonTdProps}
                    ps={0}
                    verticalAlign="baseline"
                    userSelect="text"
                >
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
                {customColumns.map((col) => (
                    <Td
                        {...commonTdProps}
                        verticalAlign="baseline"
                        key={col.id}
                    >
                        {col.valueFor(resource)}
                    </Td>
                ))}
                {showNamespace && (
                    <Td {...commonTdProps} verticalAlign="baseline">
                        <Selectable display="block" isTruncated>
                            {resource.metadata.namespace}
                        </Selectable>
                    </Td>
                )}
                <Td {...commonTdProps} verticalAlign="baseline">
                    <Selectable display="block" isTruncated>
                        {formatDeveloperDateTime(creationDate)}
                    </Selectable>
                </Td>
            </Tr>

            {customBoxes.map((box) => (
                <Tr key={box.id}>
                    <Td></Td>
                    <Td
                        ps={0}
                        pt={0}
                        colSpan={
                            2 + (showNamespace ? 1 : 0) + customColumns.length
                        }
                    >
                        {box.value}
                    </Td>
                </Tr>
            ))}
        </>
    );
};

/**
 * This is a copy of toK8sObjectIdentifierString() in common/k8s/util.ts.
 * Parcel craps out when I import it.
 */
function toK8sObjectIdentifierString(
    obj: K8sObject | K8sObjectIdentifier
): string {
    const identifier = toK8sObjectIdentifier(obj);
    return [
        identifier.apiVersion,
        identifier.kind,
        identifier.namespace ?? "",
        identifier.name,
    ].join(":");
}
