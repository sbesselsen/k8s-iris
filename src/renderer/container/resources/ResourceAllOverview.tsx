import {
    Accordion,
    AccordionButton,
    AccordionItem,
    AccordionPanel,
    Badge,
    Box,
    Button,
    ButtonGroup,
    Heading,
    HStack,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
    useBreakpointValue,
    useToken,
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
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { useK8sListWatch } from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";

export const ResourceAllOverview: React.FC = () => {
    const [selectedResource, setSelectedResource] = useAppParam<
        K8sResourceTypeIdentifier | undefined
    >("resourceType", undefined);

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const metaKeyRef = useModifierKeyRef("Meta");

    const onSelectResource = useCallback(
        (resource: K8sResourceTypeIdentifier | undefined) => {
            if (metaKeyRef.current) {
                createWindow({
                    route: setSelectedResource.asRoute(resource),
                });
            } else {
                setSelectedResource(resource);
            }
        },
        [createWindow, metaKeyRef, setSelectedResource]
    );

    return (
        <HStack flex="1 0 0" overflow="hidden" spacing={0} alignItems="stretch">
            <ScrollBox px={2} py={2} flex="0 0 250px">
                <ResourceTypeMenu
                    selectedResource={selectedResource}
                    onSelectResource={onSelectResource}
                />
            </ScrollBox>
            <ScrollBox px={4} py={2} flex="1 0 0">
                {selectedResource && (
                    <ResourceList resourceType={selectedResource} />
                )}
            </ScrollBox>
        </HStack>
    );
};

type ResourceTypeMenuProps = {
    selectedResource?: K8sResourceTypeIdentifier | undefined;
    onSelectResource?: (
        resource: K8sResourceTypeIdentifier | undefined
    ) => void;
};

const sortOptions = {
    sensitivity: "base",
    numeric: true,
    ignorePunctuation: true,
};

const ResourceTypeMenu: React.FC<ResourceTypeMenuProps> = (props) => {
    const { selectedResource, onSelectResource } = props;
    const [_isLoadingResources, resources, _resourcesError] =
        useK8sApiResourceTypes();

    const groupedResources = useMemo(() => {
        if (!resources) {
            return [];
        }
        const groups: Record<
            string,
            Record<string, K8sResourceTypeInfo[]>
        > = {};
        for (const resource of resources) {
            if (resource.isSubResource) {
                // Only show top-level resources.
                continue;
            }

            // TODO: support polling for resource types that are not watchable
            if (
                !resource.verbs?.find((verb) => verb === "list") ||
                !resource.verbs?.find((verb) => verb === "watch")
            ) {
                // Only show listable and watchable verbs.
                continue;
            }
            let [group, version] = resource.apiVersion.split("/", 2);
            if (!version) {
                // Handle "v1" for core.
                version = group;
                group = "";
            }
            if (!groups[group]) {
                groups[group] = {};
            }
            if (!groups[group][version]) {
                groups[group][version] = [];
            }
            groups[group][version].push(resource);
        }
        return Object.entries(groups)
            .sort(([group1], [group2]) =>
                group1.localeCompare(group2, undefined, sortOptions)
            )
            .map(([groupName, versions]) => ({
                groupName,
                versions: Object.entries(versions)
                    .sort(([version1], [version2]) =>
                        (version1 + "ZZZ").localeCompare(
                            version2 + "ZZZ",
                            undefined,
                            sortOptions
                        )
                    )
                    .map(([versionName, resources]) => ({
                        versionName,
                        resources,
                    })),
            }));
    }, [resources]);

    const [expandedResourceGroup, setExpandedResourceGroup] = useAppParam<
        string | undefined
    >("group", undefined);
    const expandedIndex = useMemo(
        () =>
            groupedResources.findIndex(
                (res) => res.groupName === expandedResourceGroup
            ),
        [expandedResourceGroup, groupedResources]
    );
    const onChangeExpandedIndex = useCallback(
        (index: number) => {
            setExpandedResourceGroup(groupedResources[index]?.groupName, true);
        },
        [setExpandedResourceGroup, groupedResources]
    );

    return (
        <Accordion
            index={expandedIndex}
            onChange={onChangeExpandedIndex}
            allowToggle
        >
            {groupedResources?.map((group) => (
                <ResourceGroupMenu
                    key={group.groupName}
                    selectedResource={selectedResource}
                    onSelectResource={onSelectResource}
                    groupName={group.groupName}
                    versions={group.versions}
                />
            ))}
        </Accordion>
    );
};

type ResourceGroupMenuProps = {
    groupName: string;
    versions: Array<{
        versionName: string;
        resources: K8sResourceTypeIdentifier[];
    }>;
    onSelectResource?: (
        resource: K8sResourceTypeIdentifier | undefined
    ) => void;
    selectedResource?: K8sResourceTypeIdentifier | undefined;
};

function latestStableVersion(versions: Array<{ versionName: string }>): string {
    let latestStable: string | undefined;
    for (const version of versions) {
        if (version.versionName.match(/^v[0-9]+$/)) {
            latestStable = version.versionName;
        }
    }
    return latestStable ?? versions[versions.length - 1].versionName;
}

const ResourceGroupMenu: React.FC<ResourceGroupMenuProps> = (props) => {
    const { groupName, onSelectResource, selectedResource, versions } = props;

    const focusBoxShadow = useToken("shadows", "outline");

    // TODO: version picker
    const [paramSelectedVersion, setSelectedVersion] = useAppParam<
        string | null
    >("version", null);
    const selectedVersion =
        versions.find((version) => version.versionName === paramSelectedVersion)
            ?.versionName ?? latestStableVersion(versions);

    const resources = versions.find(
        (version) => version.versionName === selectedVersion
    ).resources;

    const onClickResourceHandlers = useMemo(
        () =>
            resources.map((resource) => {
                return () => {
                    onSelectResource?.(resource);
                };
            }),
        [onSelectResource, resources]
    );

    const onClickVersionHandlers = useMemo(
        () =>
            versions.map((version) => {
                return () => {
                    setSelectedVersion(version.versionName, true);
                };
            }),
        [setSelectedVersion, versions]
    );

    const focusShadow = useToken("shadows", "outline");

    return (
        <AccordionItem border="none">
            <AccordionButton
                ps={2}
                _focus={{}}
                _focusVisible={{
                    boxShadow: focusBoxShadow,
                }}
            >
                <Heading
                    textColor={"primary.500"}
                    fontWeight="semibold"
                    fontSize="xs"
                    textTransform="uppercase"
                >
                    {groupName || "Core"}
                </Heading>
            </AccordionButton>
            <AccordionPanel ps={2} py={0}>
                {versions.length > 1 && (
                    <ButtonGroup variant="outline" size="xs" isAttached mb={1}>
                        {versions.map((version, index) => (
                            <Button
                                key={version.versionName}
                                mr="-1px"
                                isActive={
                                    version.versionName === selectedVersion
                                }
                                onClick={onClickVersionHandlers[index]}
                                _focus={{}}
                                _focusVisible={{
                                    boxShadow: focusShadow,
                                }}
                            >
                                {version.versionName}
                            </Button>
                        ))}
                    </ButtonGroup>
                )}
                <VStack alignItems="stretch" spacing={0} pt={0} pb={2}>
                    {resources.map((resource, index) => (
                        <Button
                            key={resource.kind}
                            fontSize="sm"
                            variant="link"
                            textAlign="left"
                            fontWeight="normal"
                            display="block"
                            py={0.5}
                            borderRadius={0}
                            _focus={{}}
                            _focusVisible={{
                                boxShadow: focusBoxShadow,
                            }}
                            _active={{
                                fontWeight: "bold",
                            }}
                            _hover={{
                                textDecoration: "none",
                            }}
                            onClick={onClickResourceHandlers[index]}
                            isActive={
                                resource.apiVersion ===
                                    selectedResource?.apiVersion &&
                                resource.kind === selectedResource?.kind
                            }
                            isTruncated
                        >
                            {resource.kind}
                        </Button>
                    ))}
                </VStack>
            </AccordionPanel>
        </AccordionItem>
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
        lg:
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
                    {sortedResources.map((resource) => (
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

const ResourceRow: React.FC<{ resource: K8sObject; showNamespace: boolean }> = (
    props
) => {
    const { resource, showNamespace } = props;

    const creationDate = new Date((resource as any).metadata.creationTimestamp);

    const isNew =
        new Date().getTime() - creationDate.getTime() < 2 * 3600 * 1000;

    return (
        <Tr>
            <Td ps={0} verticalAlign="baseline">
                <HStack p={0}>
                    <Selectable display="block" isTruncated>
                        {resource.metadata.name}
                    </Selectable>
                    {isNew && <Badge colorScheme="primary">new</Badge>}
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
