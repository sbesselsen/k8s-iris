import { AddIcon } from "@chakra-ui/icons";
import {
    Badge,
    Box,
    Button,
    HStack,
    Table,
    Tbody,
    Td,
    Tfoot,
    Th,
    Thead,
    Tr,
    useBreakpointValue,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
    K8sResourceTypeInfo,
} from "../../../common/k8s/client";
import { resourceMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { newResourceEditor } from "../../context/editors";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { useK8sListWatch } from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";
import { ResourceEditorLink } from "./ResourceEditorLink";
import { ResourceTypeSelector } from "./ResourceTypeSelector";

export const ResourceAllOverview: React.FC = () => {
    const [selectedResourceType, setSelectedResourceType] = useAppParam<
        K8sResourceTypeIdentifier | undefined
    >("resourceType", undefined);

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const metaKeyRef = useModifierKeyRef("Meta");
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const onSelectResourceType = useCallback(
        (type: K8sResourceTypeIdentifier | undefined) => {
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

    const onClickAddNew = useCallback(() => {
        const editor = newResourceEditor(selectedResourceType);
        if (metaKeyRef.current) {
            createWindow({
                route: {
                    ...getAppRoute(),
                    activeEditor: editor,
                },
            });
        } else {
            setAppRoute((route) => ({
                ...route,
                activeEditor: editor,
            }));
        }
    }, [
        createWindow,
        getAppRoute,
        setAppRoute,
        metaKeyRef,
        selectedResourceType,
    ]);

    return (
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <HStack px={2} py={2} flex="0 0 auto">
                <ResourceTypeSelector
                    value={selectedResourceType}
                    onChange={onSelectResourceType}
                    emptyValueContent="Select a resource type..."
                />
            </HStack>
            <ScrollBox px={4} py={2} flex="1 0 0">
                {selectedResourceType && (
                    <VStack alignItems="stretch">
                        <ResourceList resourceType={selectedResourceType} />
                        <Box>
                            <Button
                                size="sm"
                                onClick={onClickAddNew}
                                leftIcon={<AddIcon w={2} h={2} />}
                            >
                                Add new
                            </Button>
                        </Box>
                    </VStack>
                )}
            </ScrollBox>
        </VStack>
    );
};

type ResourceListProps = {
    resourceType: K8sResourceTypeIdentifier;
};

const ResourceList: React.FC<ResourceListProps> = (props) => {
    const { resourceType } = props;

    const [_isLoadingResourcesTypes, resourcesTypesInfo, _resourcesError] =
        useK8sApiResourceTypes();

    const resourceTypeInfo = resourcesTypesInfo?.find(
        (info) =>
            info.apiVersion === resourceType.apiVersion &&
            info.kind === resourceType.kind &&
            !info.isSubResource
    );

    return resourceTypeInfo ? (
        <InnerResourceList resourceTypeInfo={resourceTypeInfo} />
    ) : null;
};

type InnerResourceListProps = {
    resourceTypeInfo: K8sResourceTypeInfo;
};

const InnerResourceList: React.FC<InnerResourceListProps> = (props) => {
    const { resourceTypeInfo } = props;

    const namespaces = useK8sNamespaces();

    const [_isLoadingResources, resources, _resourcesError] = useK8sListWatch(
        {
            apiVersion: resourceTypeInfo.apiVersion,
            kind: resourceTypeInfo.kind,
            ...(namespaces.mode === "all" || !resourceTypeInfo.namespaced
                ? {}
                : { namespaces: namespaces.selected }),
        },
        {},
        [namespaces, resourceTypeInfo]
    );

    const { query } = useAppSearch();

    const filteredResources = useMemo(() => {
        if (!resources || !query) {
            return resources?.items ?? [];
        }
        return resources.items.filter((resource) =>
            resourceMatch(query, resource)
        );
    }, [resources, query]);

    const sortedResources = useMemo(
        () =>
            [...filteredResources].sort((x, y) =>
                k8sSmartCompare(x.metadata.name, y.metadata.name)
            ),
        [filteredResources]
    );

    const showNamespace = useBreakpointValue({
        base: false,
        md:
            resourceTypeInfo.namespaced &&
            (namespaces.mode === "all" || namespaces.selected.length > 1),
    });

    return (
        <Box>
            <Table
                size="sm"
                sx={{ tableLayout: "fixed" }}
                width="100%"
                maxWidth="1000px"
            >
                <Thead>
                    <Tr>
                        <Th ps={0}>Name</Th>
                        {showNamespace && <Th width="150px">Namespace</Th>}
                        <Th width="150px">Created</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {sortedResources.map((resource, index) => (
                        <ResourceRow
                            resource={resource}
                            showNamespace={showNamespace}
                            key={
                                resource.metadata.namespace +
                                ":" +
                                resource.metadata.name
                            }
                        />
                    ))}
                </Tbody>
            </Table>
        </Box>
    );
};

type ResourceRowProps = {
    resource: K8sObject;
    showNamespace: boolean;
};

const ResourceRow: React.FC<ResourceRowProps> = (props) => {
    const { resource, showNamespace } = props;

    const creationDate = new Date((resource as any).metadata.creationTimestamp);

    const isNew =
        new Date().getTime() - creationDate.getTime() < 2 * 3600 * 1000;

    const isDeleting = Boolean((resource as any).metadata.deletionTimestamp);

    return (
        <Tr>
            <Td ps={0} verticalAlign="baseline">
                <HStack p={0}>
                    <Selectable
                        display="block"
                        textColor={isDeleting ? "gray.500" : ""}
                        isTruncated
                    >
                        <ResourceEditorLink editorResource={resource}>
                            {resource.metadata.name}
                        </ResourceEditorLink>
                    </Selectable>
                    {isNew && !isDeleting && (
                        <Badge colorScheme="primary">new</Badge>
                    )}
                    {isDeleting && <Badge colorScheme="gray">deleting</Badge>}
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
