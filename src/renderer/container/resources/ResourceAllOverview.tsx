import { HStack, VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { K8sResourceTypeIdentifier } from "../../../common/k8s/client";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import { useGuaranteedMemo } from "../../hook/guaranteed-memo";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { useK8sListWatchStore } from "../../k8s/list-watch";
import {
    createStore,
    ReadableStore,
    Store,
    useCombinedReadableStore,
    useProvidedStoreValue,
} from "../../util/state";
import { ResourcesTable, ResourcesTableStoreValue } from "./ResourcesTable";
import { ResourcesToolbar } from "./ResourcesToolbar";
import { ResourceTypeSelector } from "./ResourceTypeSelector";

export const ResourceAllOverview: React.FC = () => {
    const [selectedResourceType, setSelectedResourceType] =
        useAppParam<K8sResourceTypeIdentifier | null>("resourceType", null);

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const metaKeyRef = useModifierKeyRef("Meta");

    const onSelectResourceType = useCallback(
        (type: K8sResourceTypeIdentifier | null) => {
            if (metaKeyRef.current) {
                createWindow({
                    route: setSelectedResourceType.asRoute(type),
                });
            } else {
                setSelectedResourceType(type);
            }
        },
        [createWindow, metaKeyRef, setSelectedResourceType]
    );

    return (
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <HStack px={4} py={2} flex="0 0 auto">
                <ResourceTypeSelector
                    value={selectedResourceType}
                    onChange={onSelectResourceType}
                    emptyValueContent="Select a resource type..."
                />
            </HStack>
            {selectedResourceType && (
                <InnerResourceTypeOverview
                    resourceType={selectedResourceType}
                />
            )}
        </VStack>
    );
};

export const ResourceTypeOverview: React.FC<{
    resourceType: K8sResourceTypeIdentifier;
}> = (props) => {
    const { resourceType } = props;

    return (
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <InnerResourceTypeOverview resourceType={resourceType} />
        </VStack>
    );
};

const InnerResourceTypeOverview: React.FC<{
    resourceType: K8sResourceTypeIdentifier;
}> = (props) => {
    const { resourceType } = props;

    const [, resourceTypes] = useK8sApiResourceTypes();

    const resourceTypeInfo = useMemo(
        () =>
            resourceTypes?.find(
                (type) =>
                    type.apiVersion === resourceType.apiVersion &&
                    type.kind === resourceType.kind &&
                    !type.isSubResource
            ),
        [resourceType, resourceTypes]
    );

    const namespaces = useK8sNamespaces();

    const queries = useMemo(() => {
        if (!resourceTypeInfo) {
            return [];
        }
        const selectNamespaces =
            namespaces.mode === "selected" && resourceTypeInfo.namespaced;
        return [
            {
                ...resourceType,
                ...(selectNamespaces
                    ? { namespaces: namespaces.selected }
                    : {}),
            },
        ];
    }, [namespaces, resourceTypeInfo]);

    const resourcesStore = useK8sListWatchStore(queries, {}, [queries]);

    const selectedKeysStore = useGuaranteedMemo(
        () => createStore<Set<string>>(new Set()),
        [resourcesStore]
    );

    const onChangeSelectedKeys = useCallback(
        (keys: Record<string, boolean>) => {
            selectedKeysStore.set((oldValue) => {
                let isUpdated = false;
                const newValue = new Set(oldValue);
                for (const [k, v] of Object.entries(keys)) {
                    if (v !== newValue.has(k)) {
                        isUpdated = true;
                    }
                    if (v) {
                        newValue.add(k);
                    } else {
                        newValue.delete(k);
                    }
                }
                return isUpdated ? newValue : oldValue;
            });
        },
        [selectedKeysStore]
    );

    const showNamespace =
        (namespaces.mode === "all" || namespaces.selected.length > 1) &&
        (resourceTypeInfo?.namespaced ?? false);

    return (
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <ScrollBox
                flex="1 0 0"
                attachedToolbar={
                    <StoreBasedResourcesToolbar
                        resourceType={resourceType}
                        resourcesStore={resourcesStore}
                        selectedKeysStore={selectedKeysStore}
                    />
                }
            >
                <ResourcesTable
                    onChangeSelectedKeys={onChangeSelectedKeys}
                    selectedKeysStore={selectedKeysStore}
                    resourcesStore={resourcesStore}
                    showNamespace={showNamespace}
                />
            </ScrollBox>
        </VStack>
    );
};

const StoreBasedResourcesToolbar: React.FC<{
    resourceType: K8sResourceTypeIdentifier;
    resourcesStore: ReadableStore<ResourcesTableStoreValue>;
    selectedKeysStore: Store<Set<string>>;
}> = (props) => {
    const { resourceType, resourcesStore, selectedKeysStore } = props;

    const onClearSelection = useCallback(() => {
        selectedKeysStore.set(new Set());
    }, [selectedKeysStore]);

    const store = useCombinedReadableStore(resourcesStore, selectedKeysStore);
    const resources = useProvidedStoreValue(
        store,
        ([resources, selectedKeys]) =>
            [...selectedKeys]
                .map((key) => resources.resources[key])
                .filter((x) => x !== undefined)
    );

    return (
        <ResourcesToolbar
            resourceType={resourceType}
            onClearSelection={onClearSelection}
            resources={resources}
        />
    );
};
