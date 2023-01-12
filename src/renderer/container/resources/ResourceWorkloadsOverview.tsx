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
import {
    isSetLike,
    toK8sObjectIdentifier,
    updateResourceListByVersion,
} from "../../../common/k8s/util";
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
    K8sListWatchesListenerOptions,
    useK8sListWatchesListener,
} from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";
import { create } from "../../util/state";
import { ResourceContextMenu } from "./ResourceContextMenu";
import { ResourceEditorLink } from "./ResourceEditorLink";
import { ResourcesToolbar } from "./ResourcesToolbar";

type WorkloadsStore = {
    groups: Record<string, WorkloadResourceGroup>;
    groupSubResources: Record<string, K8sObject[]>;
    allResourcesByType: Record<
        string,
        { isLoading: boolean; resources: K8sObject[]; error: undefined | any }
    >;
    selectedResourceKeys: Set<string>;
    showNamespace: boolean;
    shouldDefaultExpandGroups: boolean;
};

type WorkloadResourceGroup = {
    id: string;
    title: string;
    contains: (resource: K8sObject) => boolean;
    shouldDefaultExpand: boolean;
    sortOrder: number;
};

const resourceTypes: Record<string, { title: string }> = {
    deployments: { title: "Deployments" },
    statefulSets: { title: "StatefulSets" },
    daemonSets: { title: "DaemonSets" },
    persistentVolumeClaims: { title: "Persistent Volume Claims" },
    ingresses: { title: "Ingresses" },
    services: { title: "Services" },
    configMaps: { title: "ConfigMaps" },
    secrets: { title: "Secrets" },
};

const storeEmptyState: WorkloadsStore = {
    groups: {},
    groupSubResources: {},
    allResourcesByType: Object.fromEntries(
        Object.keys(resourceTypes).map((k) => [
            k,
            { isLoading: true, resources: [], error: undefined },
        ])
    ),
    selectedResourceKeys: new Set(),
    showNamespace: false,
    shouldDefaultExpandGroups: false,
};

const { useStore, useStoreValue, store } = create(storeEmptyState);
// store.subscribe((value) => {
//     console.log("store", value });
// });

export const ResourceWorkloadsOverview: React.FC<{}> = () => {
    return (
        <ScrollBox flex="1 0 0" attachedToolbar={<ResourceWorkloadsToolbar />}>
            <WorkloadsMonitor />
            <GroupedResourcesOverview />
        </ScrollBox>
    );
};

export const ResourceWorkloadsToolbar: React.FC<{}> = () => {
    const store = useStore();

    const onClearSelection = useCallback(() => {
        store.set((value) => ({ ...value, selectedResourceKeys: new Set() }));
    }, [store]);

    const selectedResourceKeys = useStoreValue(
        (value) => value.selectedResourceKeys
    );
    const resourcesByType = useStoreValue((value) => value.allResourcesByType);
    const selectedResources = useMemo(() => {
        const output: K8sObject[] = [];
        for (const { resources } of Object.values(resourcesByType)) {
            const selectedTypeResources = resources.filter((resource) =>
                selectedResourceKeys.has(toK8sObjectIdentifierString(resource))
            );
            output.push(...selectedTypeResources);
        }
        return output;
    }, [resourcesByType, selectedResourceKeys]);

    return (
        <ResourcesToolbar
            resources={selectedResources}
            onClearSelection={onClearSelection}
        />
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
            shouldDefaultExpandGroups:
                namespaces.mode === "selected" &&
                namespaces.selected.length === 1,
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
                        } else if (newGroups[group.id].title !== group.title) {
                            // Changed group.
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
                    const newSelectedResourceKeys = new Set(
                        oldValue.selectedResourceKeys
                    );
                    const availableResourceKeys: Set<string> = new Set();
                    const newGroupSubResources: Record<string, K8sObject[]> =
                        {};
                    for (const [type, typeResources] of Object.entries(
                        newValue.allResourcesByType
                    )) {
                        for (const resource of typeResources.resources) {
                            availableResourceKeys.add(
                                toK8sObjectIdentifierString(resource)
                            );
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
                    for (const key of [...newSelectedResourceKeys]) {
                        if (!availableResourceKeys.has(key)) {
                            // Remove selected item when it disappears.
                            newSelectedResourceKeys.delete(key);
                        }
                    }
                    newValue.selectedResourceKeys = newSelectedResourceKeys;

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
        persistentVolumeClaims: {
            apiVersion: "v1",
            kind: "PersistentVolumeClaim",
            ...defaultSpecItems,
        },
    };

    useK8sListWatchesListener(specs, listWatchOptions, [namespaces]);
}

type WorkloadResourceGroupGenerator = (
    resources: K8sObject[]
) => WorkloadResourceGroup[];

function computeGroups(resources: K8sObject[]): WorkloadResourceGroup[] {
    const generators: WorkloadResourceGroupGenerator[] = [
        computeHelmGroups,
        computePodSetGroups,
        computeDefaultGroups,
    ];

    let remainingResources: K8sObject[] = resources;
    const outputGroups: WorkloadResourceGroup[] = [];
    for (const generator of generators) {
        const groups = generator(remainingResources).filter((group) => {
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
        outputGroups.push(...groups);
    }
    return outputGroups;
}

function computeDefaultGroups(): WorkloadResourceGroup[] {
    return [
        {
            id: "helm-release-data",
            title: "Helm release data",
            contains: (resource: K8sObject) =>
                !!resource.metadata.name.match(/^sh\.helm\.release\./),
            sortOrder: 101,
            shouldDefaultExpand: false,
        },
        {
            id: "kube-stuff",
            title: "Kubernetes stuff",
            contains: (resource: K8sObject) =>
                resource.metadata.annotations?.[
                    "kubernetes.io/service-account.name"
                ] === "default" ||
                resource.metadata.name === "kube-root-ca.crt",
            sortOrder: 102,
            shouldDefaultExpand: false,
        },
        {
            id: "service-account-tokens",
            title: "Service account tokens",
            contains: (resource: K8sObject) =>
                !!resource.metadata.annotations?.[
                    "kubernetes.io/service-account.name"
                ],
            sortOrder: 103,
            shouldDefaultExpand: false,
        },
        {
            id: "_",
            title: "Uncategorized",
            contains: () => true,
            sortOrder: 100,
            shouldDefaultExpand: true,
        },
    ];
}

function computePodSetGroups(resources: K8sObject[]): WorkloadResourceGroup[] {
    const groupInfo: Record<
        string,
        {
            title: string;
            namespace: string;
            labelSelector: Record<string, string>;
        }
    > = {};
    const namespacesByTitle: Record<string, Record<string, string>> = {};
    const relatedResourceGroupIds: Record<string, string> = {};

    const findLabelSelector = (
        resource: K8sObject
    ): Record<string, string> | null => {
        const r = resource as any;
        if (
            r.spec?.selector?.matchLabels &&
            typeof r.spec.selector.matchLabels === "object"
        ) {
            const matchLabels = r.spec.selector.matchLabels;
            let hasValues = false;
            for (const k of Object.keys(matchLabels)) {
                hasValues = true;
                if (typeof matchLabels[k] !== "string") {
                    return null;
                }
            }
            if (hasValues) {
                return matchLabels;
            }
        }
        return null;
    };

    function matchesLabelSelector(
        labels: Record<string, string>,
        selector: Record<string, string>
    ): boolean {
        for (const [k, v] of Object.entries(selector)) {
            if (labels[k] !== v) {
                return false;
            }
        }
        return true;
    }

    const findPodSetGroup = (resource: K8sObject): string | null => {
        const resourceId = toK8sObjectIdentifierString(resource);
        if (relatedResourceGroupIds[resourceId]) {
            return relatedResourceGroupIds[resourceId];
        }
        if (isSetLike(resource)) {
            const labelSelector = findLabelSelector(resource);
            if (labelSelector) {
                // This is the group.
                groupInfo[resourceId] = {
                    title: resource.metadata.name,
                    namespace: resource.metadata.namespace as string,
                    labelSelector,
                };
                return resourceId;
            }
        }
        if (resource.apiVersion === "v1" && resource.kind === "Service") {
            for (const [groupId, group] of Object.entries(groupInfo)) {
                if (
                    matchesLabelSelector(
                        (resource as any)?.spec?.selector ?? {},
                        group.labelSelector
                    ) &&
                    matchesLabelSelector(
                        group.labelSelector,
                        (resource as any)?.spec?.selector ?? {}
                    )
                ) {
                    relatedResourceGroupIds[resourceId] = groupId;
                    return groupId;
                }
            }
        }
        // If this is an ingress, check by service.
        if (
            resource.apiVersion === "networking.k8s.io/v1" &&
            resource.kind === "Ingress"
        ) {
            for (const rule of (resource as any).spec?.rules ?? []) {
                for (const path of rule?.http?.paths ?? []) {
                    if (path?.backend?.service?.name) {
                        const serviceIdentifier = toK8sObjectIdentifierString({
                            apiVersion: "v1",
                            kind: "Service",
                            name: path.backend.service.name,
                            namespace: resource.metadata.namespace,
                        });
                        if (relatedResourceGroupIds[serviceIdentifier]) {
                            relatedResourceGroupIds[resourceId] =
                                relatedResourceGroupIds[serviceIdentifier];
                            return relatedResourceGroupIds[resourceId];
                        }
                    }
                }
            }
        }
        return null;
    };

    // Make sure we get the sets first, then the services, then everything else.
    const sortedResources = resources.sort((r1, r2) => {
        const r1IsSet = isSetLike(r1);
        const r2IsSet = isSetLike(r2);
        if (r1IsSet !== r2IsSet) {
            return r1IsSet ? -1 : 1;
        }
        const r1IsService = r1.apiVersion === "v1" && r1.kind === "Service";
        const r2IsService = r2.apiVersion === "v1" && r2.kind === "Service";
        if (r1IsService !== r2IsService) {
            return r1IsService ? -1 : 1;
        }
        return r1.metadata.name.localeCompare(r2.metadata.name);
    });

    for (const resource of sortedResources) {
        const groupId = findPodSetGroup(resource);
        if (
            groupId !== null &&
            resource.apiVersion === "networking.k8s.io/v1" &&
            resource.kind === "Ingress"
        ) {
            for (const tlsItem of (resource as any)?.spec?.tls ?? []) {
                if (tlsItem.secretName) {
                    relatedResourceGroupIds[
                        `v1:Secret:${resource.metadata.namespace}:${tlsItem.secretName}`
                    ] = groupId;
                }
            }
        }
        if (groupId !== null) {
            const serviceAccount =
                (resource as any)?.spec?.template?.spec?.serviceAccount ??
                (resource as any)?.spec?.template?.spec?.serviceAccountName;
            if (serviceAccount) {
                relatedResourceGroupIds[
                    `v1:ServiceAccount:${resource.metadata.namespace}:${serviceAccount}`
                ] = groupId;
            }
        }
    }

    return Object.entries(groupInfo).map(([id, info]) => {
        let title = info.title;
        if (
            namespacesByTitle[info.title] &&
            Object.values(namespacesByTitle[info.title]).length > 1
        ) {
            title += ` (${info.namespace})`;
        }
        return {
            id,
            title,
            contains(resource) {
                return findPodSetGroup(resource) === id;
            },
            sortOrder: 0,
            shouldDefaultExpand: true,
        };
    });
}

function computeHelmGroups(resources: K8sObject[]): WorkloadResourceGroup[] {
    const groupInfo: Record<
        string,
        {
            instance: string;
            namespace: string;
        }
    > = {};
    const namespacesByInstance: Record<string, Record<string, string>> = {};
    const relatedResourceGroupIds: Record<string, string> = {};

    const findHelmGroup = (resource: K8sObject): string | null => {
        if (
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
        if (
            resource.metadata.annotations?.[
                "objectset.rio.cattle.io/owner-namespace"
            ] &&
            resource.metadata.annotations?.[
                "objectset.rio.cattle.io/owner-name"
            ]
        ) {
            const namespace =
                resource.metadata.annotations[
                    "objectset.rio.cattle.io/owner-namespace"
                ];
            const instance =
                resource.metadata.annotations?.[
                    "objectset.rio.cattle.io/owner-name"
                ];
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
            return groupId;
        }
        const relatedResourceKey = `${resource.apiVersion}:${resource.kind}:${resource.metadata.namespace}:${resource.metadata.name}`;
        if (relatedResourceGroupIds[relatedResourceKey]) {
            return relatedResourceGroupIds[relatedResourceKey];
        }
        if (
            resource.metadata.annotations?.[
                "kubernetes.io/service-account.name"
            ]
        ) {
            const relatedServiceAccountKey = `v1:ServiceAccount:${resource.metadata.namespace}:${resource.metadata.annotations["kubernetes.io/service-account.name"]}`;
            if (relatedResourceGroupIds[relatedServiceAccountKey]) {
                return relatedResourceGroupIds[relatedServiceAccountKey];
            }
        }
        return null;
    };

    for (const resource of resources) {
        const groupId = findHelmGroup(resource);
        if (
            groupId !== null &&
            resource.apiVersion === "networking.k8s.io/v1" &&
            resource.kind === "Ingress"
        ) {
            for (const tlsItem of (resource as any)?.spec?.tls ?? []) {
                if (tlsItem.secretName) {
                    relatedResourceGroupIds[
                        `v1:Secret:${resource.metadata.namespace}:${tlsItem.secretName}`
                    ] = groupId;
                }
            }
        }
        if (groupId !== null) {
            const serviceAccount =
                (resource as any)?.spec?.template?.spec?.serviceAccount ??
                (resource as any)?.spec?.template?.spec?.serviceAccountName;
            if (serviceAccount) {
                relatedResourceGroupIds[
                    `v1:ServiceAccount:${resource.metadata.namespace}:${serviceAccount}`
                ] = groupId;
            }
        }
    }

    return Object.entries(groupInfo).map(([id, info]) => {
        let title = info.instance;
        if (
            namespacesByInstance[info.instance] &&
            Object.values(namespacesByInstance[info.instance]).length > 1
        ) {
            title += ` (${info.namespace})`;
        }
        return {
            id,
            title,
            contains(resource) {
                return findHelmGroup(resource) === id;
            },
            sortOrder: 0,
            shouldDefaultExpand: true,
        };
    });
}

const GroupedResourcesOverview: React.FC<{}> = () => {
    const groups = useStoreValue((value) => value.groups);
    const isAnythingLoading = useStoreValue((value) =>
        Object.values(value.allResourcesByType).some((r) => r.isLoading)
    );

    const sortedGroups = useMemo(
        () =>
            Object.values(groups).sort((a, b) => {
                const aSortOrder = a.sortOrder ?? 0;
                const bSortOrder = b.sortOrder ?? 0;
                if (aSortOrder !== bSortOrder) {
                    return aSortOrder - bSortOrder;
                }
                return k8sSmartCompare(a.title, b.title);
            }),
        [groups]
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
        const { selectedResourceKeys, allResourcesByType } = store.get();
        return Object.values(allResourcesByType).flatMap((group) =>
            group.resources.filter((r) =>
                selectedResourceKeys.has(toK8sObjectIdentifierString(r))
            )
        );
    }, [store]);

    return (
        <ResourceContextMenu objects={getSelectedObjects}>
            <VStack alignItems="stretch" spacing={2}>
                {filteredGroups.map((group) => (
                    <WorkloadGroup groupId={group.id} key={group.id} />
                ))}
                {filteredGroups.length === 0 && !isAnythingLoading && (
                    <Box>
                        <Text color="gray">No workloads selected.</Text>
                    </Box>
                )}
                {isAnythingLoading && (
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
    const group = useStoreValue((value) => value.groups[groupId], [groupId]);
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

const emptyResourcesList: K8sObject[] = [];

const WorkloadResourceSection: React.FC<WorkloadResourceSectionProps> =
    React.memo((props) => {
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

        if (!isLoading && resources.length === 0) {
            return null;
        }

        return (
            <VStack alignItems="stretch">
                <Heading fontSize="sm" px={4}>
                    {title}
                </Heading>
                {isLoading && (
                    <Box px={4}>
                        <Spinner color="gray" size="sm" />
                    </Box>
                )}
                {!isLoading && (
                    <WorkloadResourceList
                        showNamespace={showNamespace}
                        resources={resources}
                    />
                )}
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
