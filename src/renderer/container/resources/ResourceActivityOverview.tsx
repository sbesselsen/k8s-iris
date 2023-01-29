import { Heading, HStack, VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { K8sObjectListQuery } from "../../../common/k8s/client";
import { reuseShallowEqualObject } from "../../../common/util/deep-equal";
import { applyMutations, union } from "../../../common/util/set";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useGuaranteedMemo } from "../../hook/guaranteed-memo";
import { useK8sListWatchStore } from "../../k8s/list-watch";
import {
    createStore,
    ReadableStore,
    useCombinedReadableStore,
    useDerivedReadableStore,
    useProvidedStoreValue,
} from "../../util/state";
import { ClusterEventsOverview } from "../cluster/ClusterEventsOverview";
import { ResourcesTable, ResourcesTableStoreValue } from "./ResourcesTable";
import { ResourcesToolbar } from "./ResourcesToolbar";

const workloadTypes = [
    {
        apiVersion: "apps/v1",
        kind: "Deployment",
    },
    {
        apiVersion: "apps/v1",
        kind: "StatefulSet",
    },
    {
        apiVersion: "apps/v1",
        kind: "DaemonSet",
    },
    {
        apiVersion: "batch/v1",
        kind: "CronJob",
    },
];

export const ResourceActivityOverview: React.FC<{}> = () => {
    const namespaces = useK8sNamespaces();
    const namespacesSelector = useMemo(
        () =>
            namespaces.mode === "all"
                ? {}
                : { namespaces: namespaces.selected },
        [namespaces]
    );
    const showNamespace =
        namespaces.mode === "all" || namespaces.selected.length > 1;
    const workloadsSpecs: K8sObjectListQuery[] = useMemo(
        () => workloadTypes.map((spec) => ({ ...spec, ...namespacesSelector })),
        [namespacesSelector]
    );
    const workloadsStore = useK8sListWatchStore(workloadsSpecs, {}, [
        workloadsSpecs,
    ]);
    const podsStore = useK8sListWatchStore(
        {
            apiVersion: "v1",
            kind: "Pod",
            ...namespacesSelector,
        },
        {},
        [namespacesSelector]
    );

    const allResourcesStore = useDerivedReadableStore(
        useCombinedReadableStore(workloadsStore, podsStore),
        (
            [workloads, pods],
            prevValue,
            prevOutput: ResourcesTableStoreValue | undefined
        ) => {
            let identifiers: Set<string> = prevOutput?.identifiers ?? new Set();
            if (
                workloads.identifiers !== prevValue?.[0]?.identifiers ||
                pods.identifiers !== prevValue?.[1]?.identifiers
            ) {
                // Update the identifiers.
                identifiers = union(workloads.identifiers, pods.identifiers);
            }
            const resources = { ...workloads.resources, ...pods.resources };
            return reuseShallowEqualObject(
                { identifiers, resources } as ResourcesTableStoreValue,
                prevOutput
            );
        }
    );

    const selectedKeysStore = useGuaranteedMemo(
        () => createStore(new Set<string>()),
        [allResourcesStore]
    );

    const onChangeSelectedKeys = useCallback(
        (keys: Record<string, boolean>) => {
            selectedKeysStore.set((oldValue) => applyMutations(oldValue, keys));
        },
        [selectedKeysStore]
    );

    return (
        <VStack
            flex="1 0 0"
            alignItems="stretch"
            spacing={0}
            position="relative"
        >
            <ActivityToolbar
                selectedKeysStore={selectedKeysStore}
                onChangeSelectedKeys={onChangeSelectedKeys}
                resourcesStore={allResourcesStore}
            />
            <VStack
                pt={4}
                flexBasis="20%"
                minHeight="200px"
                alignItems="stretch"
            >
                <Heading px={4} size="sm">
                    Events
                </Heading>
                <ClusterEventsOverview />
            </VStack>
            <HStack flex="1 0 0" alignItems="stretch" spacing={0}>
                <VStack pt={4} w="50%" alignItems="stretch">
                    <Heading px={4} size="sm">
                        Workloads
                    </Heading>
                    <ScrollBox>
                        <ResourcesTable
                            resourcesStore={workloadsStore}
                            showNamespace={showNamespace}
                            selectedKeysStore={selectedKeysStore}
                            onChangeSelectedKeys={onChangeSelectedKeys}
                        />
                    </ScrollBox>
                </VStack>
                <VStack pt={4} w="50%" alignItems="stretch">
                    <Heading px={4} size="sm">
                        Pods
                    </Heading>
                    <ScrollBox>
                        <ResourcesTable
                            resourcesStore={podsStore}
                            showNamespace={showNamespace}
                            selectedKeysStore={selectedKeysStore}
                            onChangeSelectedKeys={onChangeSelectedKeys}
                        />
                    </ScrollBox>
                </VStack>
            </HStack>
        </VStack>
    );
};

type ActivityToolbarProps = {
    selectedKeysStore: ReadableStore<Set<string>>;
    onChangeSelectedKeys: (keys: Record<string, boolean>) => void;
    resourcesStore: ReadableStore<ResourcesTableStoreValue>;
};

const ActivityToolbar: React.FC<ActivityToolbarProps> = (props) => {
    const { resourcesStore, selectedKeysStore, onChangeSelectedKeys } = props;

    const onClearSelection = useCallback(() => {
        onChangeSelectedKeys(
            Object.fromEntries(
                [...selectedKeysStore.get()].map((k) => [k, false])
            )
        );
    }, [selectedKeysStore, onChangeSelectedKeys]);

    const resources = useProvidedStoreValue(
        useCombinedReadableStore(resourcesStore, selectedKeysStore),
        ([{ identifiers, resources }, selectedKeys]) => {
            return [...identifiers]
                .filter((key) => selectedKeys.has(key))
                .map((key) => resources[key])
                .filter((r) => r !== undefined);
        },
        [selectedKeysStore]
    );

    return (
        <HStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            pb={3}
            px={6}
            justifyContent="center"
            pointerEvents="none"
            zIndex={2}
            sx={{ "> *": { pointerEvents: "auto" } }}
        >
            <ResourcesToolbar
                resources={resources}
                onClearSelection={onClearSelection}
            />
        </HStack>
    );
};
