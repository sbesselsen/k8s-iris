import { ChevronDownIcon } from "@chakra-ui/icons";
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
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuList,
    Table,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useBreakpointValue,
    useControllableState,
    useDisclosure,
    useToken,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
    K8sResourceTypeInfo,
} from "../../../common/k8s/client";
import { resourceMatch, searchMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { MenuInput } from "../../component/MenuInput";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { useK8sListWatch } from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";
import { ResourceEditorLink } from "./ResourceEditorLink";

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
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <Box px={2} py={2} flex="0 0 auto">
                <ResourceTypeSelector
                    value={selectedResource}
                    onChange={onSelectResource}
                />
            </Box>
            <ScrollBox px={4} py={2} flex="1 0 0">
                {selectedResource && (
                    <ResourceList resourceType={selectedResource} />
                )}
            </ScrollBox>
        </VStack>
    );
};

type ResourceTypeSelectorProps = {
    value?: K8sResourceTypeIdentifier | undefined;
    onChange?: (
        value: K8sResourceTypeIdentifier | undefined,
        requestNewWindow: boolean
    ) => void;
};

function apiGroup(apiVersion: string): string {
    return apiVersion.indexOf("/") > -1 ? apiVersion.split("/", 2)[0] : "";
}

const sortOptions = {
    sensitivity: "base",
    numeric: true,
    ignorePunctuation: true,
};

const ResourceTypeSelector: React.FC<ResourceTypeSelectorProps> = (props) => {
    const { value, onChange } = props;

    const [stateValue, setStateValue] = useControllableState({
        value,
        onChange: onChange as any,
    });

    const [_isLoadingResourceTypes, resourceTypes, _resourceTypesError] =
        useK8sApiResourceTypes();

    const metaKeyPressedRef = useModifierKeyRef("Meta");
    const [searchValue, setSearchValue] = useState("");
    const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();

    const onClose = useCallback(() => {
        setSearchValue("");
        onDisclosureClose();
    }, [onDisclosureClose, setSearchValue]);

    const onChangeSearchInput = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(e.target.value);
        },
        [setSearchValue]
    );

    type ProcessedResourceType = {
        kind: string;
        group: string;
        types: K8sResourceTypeInfo[];
    };
    const processedResourceTypes: ProcessedResourceType[] = useMemo(() => {
        const resourcesByKey: Record<string, ProcessedResourceType> = {};
        const output: ProcessedResourceType[] = [];
        for (const resourceType of resourceTypes ?? []) {
            if (resourceType.isSubResource) {
                // Only show top-level resources.
                continue;
            }

            // TODO: support polling for resource types that are not watchable
            if (
                !resourceType.verbs?.find((verb) => verb === "list") ||
                !resourceType.verbs?.find((verb) => verb === "watch")
            ) {
                // Only show listable and watchable verbs.
                continue;
            }
            const group = apiGroup(resourceType.apiVersion);
            const groupingKey = `${group}/${resourceType.kind}`;
            if (resourcesByKey[groupingKey]) {
                resourcesByKey[groupingKey].types.push(resourceType);
            } else {
                const processedResourceType = {
                    kind: resourceType.kind,
                    group,
                    types: [resourceType],
                };
                resourcesByKey[groupingKey] = processedResourceType;
                output.push(processedResourceType);
            }
        }
        for (const record of output) {
            record.types.sort((t1, t2) =>
                (t1.apiVersion + "ZZZ").localeCompare(
                    t2.apiVersion + "ZZZ",
                    undefined,
                    sortOptions
                )
            );
        }
        return output;
    }, [resourceTypes]);

    const filteredResourceTypes: ProcessedResourceType[] = useMemo(() => {
        if (!searchValue) {
            return processedResourceTypes;
        }
        return processedResourceTypes.filter((type) =>
            searchMatch(
                searchValue,
                [
                    type.kind,
                    type.group,
                    type.types.map((t) => t.apiVersion).join(" "),
                ].join(" ")
            )
        );
    }, [processedResourceTypes, searchValue]);

    const groupedResourceTypes: Array<{
        title: string;
        types: ProcessedResourceType[];
    }> = useMemo(() => {
        const groupsByKey: Record<string, ProcessedResourceType[]> = {};
        const output: Array<{ title: string; types: ProcessedResourceType[] }> =
            [];
        for (const type of filteredResourceTypes) {
            const title = type.group || "core";
            if (groupsByKey[title]) {
                groupsByKey[title].push(type);
            } else {
                const record = { title, types: [type] };
                groupsByKey[title] = record.types;
                output.push(record);
            }
        }
        return output;
    }, [filteredResourceTypes]);

    const versionedTypes = useMemo(
        () =>
            stateValue
                ? processedResourceTypes.find((pt) =>
                      pt.types.some(
                          (t) =>
                              t.apiVersion === stateValue.apiVersion &&
                              t.kind === stateValue.kind
                      )
                  )?.types
                : null,
        [processedResourceTypes, stateValue]
    );
    const onClickVersionedTypes = useMemo(
        () =>
            versionedTypes?.map((type) => () => {
                setStateValue(type);
            }),
        [setStateValue, versionedTypes]
    );

    const onSelectType = useCallback(
        (type: ProcessedResourceType) => {
            setStateValue(type.types[type.types.length - 1]);
            onClose();
        },
        [onClose, setStateValue]
    );

    const onClickHandlers = useMemo(
        () =>
            Object.fromEntries(
                processedResourceTypes.map((type) => [
                    `${type.group}/${type.kind}`,
                    () => {
                        onSelectType(type);
                    },
                ])
            ),
        [processedResourceTypes]
    );

    const onPressSearchEnter = useCallback(() => {
        if (filteredResourceTypes.length === 1) {
            onSelectType(filteredResourceTypes[0]);
        }
    }, [filteredResourceTypes, onSelectType]);

    const focusBoxShadow = useToken("shadows", "outline");
    const focusShadow = useToken("shadows", "outline");

    return (
        <HStack spacing={1}>
            <Menu
                isOpen={isOpen}
                onOpen={onOpen}
                onClose={onClose}
                matchWidth={true}
                gutter={1}
            >
                <MenuButton
                    as={Button}
                    rightIcon={<ChevronDownIcon />}
                    size="sm"
                    _active={{
                        bg: "",
                    }}
                    _focus={{}}
                    _focusVisible={{
                        boxShadow: focusBoxShadow,
                    }}
                >
                    {stateValue ? (
                        <>
                            {apiGroup(stateValue.apiVersion) || "core"}:{" "}
                            {stateValue.kind}
                        </>
                    ) : (
                        ""
                    )}
                </MenuButton>
                <MenuList
                    zIndex={18}
                    maxHeight="calc(100vh - 300px)"
                    overflowY="scroll"
                >
                    <MenuInput
                        placeholder="Search"
                        value={searchValue}
                        onChange={onChangeSearchInput}
                        onPressEnter={onPressSearchEnter}
                        size="sm"
                        borderRadius="md"
                        mb={2}
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                    />
                    {groupedResourceTypes.map((group) => (
                        <MenuGroup
                            title={group.title}
                            pt={0}
                            mb={0}
                            color="gray.500"
                            fontWeight="semibold"
                            fontSize="xs"
                            textTransform="uppercase"
                            key={group.title}
                        >
                            {group.types.map((type) => (
                                <MenuItem
                                    fontSize="sm"
                                    px={8}
                                    py={1}
                                    key={type.kind}
                                    onClick={
                                        onClickHandlers[
                                            `${type.group}/${type.kind}`
                                        ]
                                    }
                                >
                                    {type.kind}
                                </MenuItem>
                            ))}
                        </MenuGroup>
                    ))}
                </MenuList>
            </Menu>

            {versionedTypes && versionedTypes.length > 1 && (
                <ButtonGroup variant="outline" size="sm" isAttached mb={1}>
                    {versionedTypes.map((type, index) => (
                        <Button
                            key={type.apiVersion}
                            mr="-1px"
                            isActive={
                                stateValue?.apiVersion === type.apiVersion
                            }
                            onClick={onClickVersionedTypes[index]}
                            _focus={{}}
                            _focusVisible={{
                                boxShadow: focusShadow,
                            }}
                        >
                            {type.apiVersion.replace(/^.*\//, "")}
                        </Button>
                    ))}
                </ButtonGroup>
            )}
        </HStack>
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

    return (
        <Tr>
            <Td ps={0} verticalAlign="baseline">
                <HStack p={0}>
                    <Selectable display="block" isTruncated>
                        <ResourceEditorLink editorResource={resource}>
                            {resource.metadata.name}
                        </ResourceEditorLink>
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
