import {
    Badge,
    Box,
    Checkbox,
    HStack,
    Table,
    TableCellProps,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
    useControllableState,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
    K8sResourceTypeInfo,
} from "../../../common/k8s/client";
import { objSameRef, resourceIdentifier } from "../../../common/k8s/util";
import { resourceMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import {
    ScrollBox,
    ScrollBoxHorizontalScroll,
} from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useMultiSelectUpdater } from "../../hook/multi-select";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import {
    generateResourceDetails,
    isResourceBox,
    isResourceColumn,
    ResourceColumn,
    ResourceDetail,
} from "../../k8s/details";
import { useK8sListWatch } from "../../k8s/list-watch";
import { formatDeveloperDateTime } from "../../util/date";
import { ResourceContextMenu } from "./ResourceContextMenu";
import { ResourceEditorLink } from "./ResourceEditorLink";
import { ResourcesToolbar } from "./ResourcesToolbar";
import { ResourceTypeSelector } from "./ResourceTypeSelector";

export const ResourceAllOverview: React.FC = () => {
    const [selectedResourceType, setSelectedResourceType] =
        useAppParam<K8sResourceTypeIdentifier | null>("resourceType", null);

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const metaKeyRef = useModifierKeyRef("Meta");

    // TODO: we should put this in an appParam but we can't because it would not fit
    // Think of something, I guess?
    const [selectedResources, onChangeSelectedResources] = useState<
        K8sObject[]
    >([]);

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

    const onClearSelection = useCallback(() => {
        onChangeSelectedResources([]);
    }, [onChangeSelectedResources]);

    return (
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <HStack px={4} py={2} flex="0 0 auto">
                <ResourceTypeSelector
                    value={selectedResourceType}
                    onChange={onSelectResourceType}
                    emptyValueContent="Select a resource type..."
                />
            </HStack>
            <ScrollBox
                flex="1 0 0"
                py={2}
                bottomToolbar={
                    <ResourcesToolbar
                        resourceType={selectedResourceType ?? undefined}
                        resources={selectedResources}
                        onClearSelection={onClearSelection}
                    />
                }
            >
                {selectedResourceType && (
                    <ResourceList
                        resourceType={selectedResourceType}
                        selectedResources={selectedResources}
                        onChangeSelectedResources={onChangeSelectedResources}
                    />
                )}
            </ScrollBox>
        </VStack>
    );
};

export const ResourceTypeOverview: React.FC<{
    resourceType: K8sResourceTypeIdentifier;
}> = (props) => {
    const { resourceType } = props;

    // TODO: we should put this in an appParam but we can't because it would not fit
    // Think of something, I guess?
    const [selectedResources, onChangeSelectedResources] = useState<
        K8sObject[]
    >([]);

    const onClearSelection = useCallback(() => {
        onChangeSelectedResources([]);
    }, [onChangeSelectedResources]);

    return (
        <VStack flex="1 0 0" spacing={0} alignItems="stretch">
            <ScrollBox
                flex="1 0 0"
                bottomToolbar={
                    <ResourcesToolbar
                        resourceType={resourceType}
                        resources={selectedResources}
                        onClearSelection={onClearSelection}
                    />
                }
            >
                <ResourceList
                    resourceType={resourceType}
                    selectedResources={selectedResources}
                    onChangeSelectedResources={onChangeSelectedResources}
                />
            </ScrollBox>
        </VStack>
    );
};

type ResourceListProps = {
    resourceType: K8sResourceTypeIdentifier;
    defaultSelectedResources?: K8sObject[];
    selectedResources?: K8sObject[];
    onChangeSelectedResources?: (resources: K8sObject[]) => void;
};

const ResourceList: React.FC<ResourceListProps> = (props) => {
    const { resourceType, ...otherProps } = props;

    const [, resourcesTypesInfo] = useK8sApiResourceTypes();

    const resourceTypeInfo = resourcesTypesInfo?.find(
        (info) =>
            info.apiVersion === resourceType.apiVersion &&
            info.kind === resourceType.kind &&
            !info.isSubResource
    );

    return resourceTypeInfo ? (
        <InnerResourceList
            resourceTypeInfo={resourceTypeInfo}
            {...otherProps}
        />
    ) : null;
};

type InnerResourceListProps = {
    resourceTypeInfo: K8sResourceTypeInfo;
    defaultSelectedResources?: K8sObject[];
    selectedResources?: K8sObject[];
    onChangeSelectedResources?: (resources: K8sObject[]) => void;
};

const InnerResourceList: React.FC<InnerResourceListProps> = (props) => {
    const {
        resourceTypeInfo,
        defaultSelectedResources = [],
        selectedResources,
        onChangeSelectedResources,
    } = props;

    const [selectedResourcesState, setSelectedResources] = useControllableState(
        {
            defaultValue: defaultSelectedResources,
            value: selectedResources,
            onChange: onChangeSelectedResources,
        }
    );

    const namespaces = useK8sNamespaces();

    const [, resources] = useK8sListWatch(
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

    const selectedResourcesRef = useRef<K8sObject[]>(selectedResourcesState);
    useEffect(() => {
        selectedResourcesRef.current = selectedResourcesState;
    }, [selectedResourcesRef, selectedResourcesState]);
    useEffect(() => {
        // Update the selected resources when the resources themselves change.
        const newSelectedResources: K8sObject[] = [];
        let hasUpdate = false;
        for (const resource of selectedResourcesRef.current) {
            const freshResource = resources?.items.find((r) =>
                objSameRef(r, resource)
            );
            if (freshResource) {
                newSelectedResources.push(freshResource);
            }
            if (freshResource === resource) {
                continue;
            }
            hasUpdate = true;
        }
        if (hasUpdate) {
            setSelectedResources(newSelectedResources);
        }
    }, [resources, selectedResourcesRef, setSelectedResources]);

    const { query } = useAppSearch();

    const filteredResources = useMemo(() => {
        if (!resources || !query) {
            return resources?.items ?? [];
        }
        return resources.items.filter((resource) =>
            resourceMatch(query, resource)
        );
    }, [resources, query]);

    const sortedKeyedResources = useMemo(
        () =>
            [...filteredResources]
                .sort((x, y) =>
                    k8sSmartCompare(x.metadata.name, y.metadata.name)
                )
                .map((resource) => ({
                    key: resourceIdentifier(resource),
                    resource,
                })),
        [filteredResources]
    );

    const showNamespace =
        resourceTypeInfo.namespaced &&
        (namespaces.mode === "all" || namespaces.selected.length > 1);

    const keys = useMemo(
        () => sortedKeyedResources.map(({ key }) => key),
        [sortedKeyedResources]
    );

    const selectedResourceIdentifiers = useMemo(
        () => selectedResourcesState.map((r) => resourceIdentifier(r)),
        [selectedResourcesState]
    );
    const setSelectedResourceIdentifiers = useCallback(
        (updater: (keys: string[]) => string[]) => {
            setSelectedResources((selectedResources) => {
                const keys = selectedResources.map((r) =>
                    resourceIdentifier(r)
                );
                const newKeys = updater(keys);
                if (newKeys === keys) {
                    return selectedResources;
                }
                const keyedResources = Object.fromEntries(
                    (resources?.items ?? []).map((r) => [
                        resourceIdentifier(r),
                        r,
                    ])
                );
                return newKeys.map((key) => keyedResources[key]);
            });
        },
        [resources, setSelectedResources]
    );

    const shiftKeyRef = useModifierKeyRef("Shift");
    const updateSelection = useMultiSelectUpdater(
        keys,
        selectedResourceIdentifiers
    );

    const onSelectHandlers = useMemo(
        () =>
            Object.fromEntries(
                sortedKeyedResources.map(({ key }) => [
                    key,
                    (selected: boolean) => {
                        setSelectedResourceIdentifiers((keys) => {
                            if (selected === keys.includes(key)) {
                                return keys;
                            }
                            return updateSelection(
                                selected
                                    ? [...keys, key]
                                    : keys.filter((k) => k !== key),
                                shiftKeyRef.current
                            );
                        });
                    },
                ])
            ),
        [
            setSelectedResourceIdentifiers,
            shiftKeyRef,
            sortedKeyedResources,
            updateSelection,
        ]
    );

    const onChangeSelectAll = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setSelectedResourceIdentifiers(() =>
                e.target.checked
                    ? sortedKeyedResources.map(({ key }) => key)
                    : []
            );
        },
        [setSelectedResourceIdentifiers, sortedKeyedResources]
    );

    const customDetails = useMemo(
        () => generateResourceDetails(resourceTypeInfo),
        [resourceTypeInfo]
    );

    function detailColWidth(col: ResourceColumn): number {
        return 40 * (col.widthUnits + 1);
    }

    const detailColumns = customDetails.filter(isResourceColumn);
    const detailColumnsTotalWidth = detailColumns
        .map(detailColWidth)
        .reduce((x, y) => x + y, 0);

    return (
        <Box>
            <ScrollBoxHorizontalScroll>
                <ResourceContextMenu objects={selectedResourcesState}>
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
                                        isIndeterminate={
                                            selectedResourceIdentifiers.length >
                                                0 &&
                                            selectedResourceIdentifiers.length <
                                                sortedKeyedResources.length
                                        }
                                        isChecked={
                                            selectedResourceIdentifiers.length >
                                                0 &&
                                            selectedResourceIdentifiers.length ===
                                                sortedKeyedResources.length
                                        }
                                        onChange={onChangeSelectAll}
                                    />
                                </Th>
                                <Th ps={0}>Name</Th>
                                {detailColumns.map((col) => (
                                    <Th
                                        key={col.id}
                                        width={detailColWidth(col) + "px"}
                                    >
                                        {col.header}
                                    </Th>
                                ))}
                                {showNamespace && (
                                    <Th width="150px">Namespace</Th>
                                )}
                                <Th width="120px">Created</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {sortedKeyedResources.map(({ key, resource }) => (
                                <ResourceRow
                                    resource={resource}
                                    showNamespace={!!showNamespace}
                                    customDetails={customDetails}
                                    key={key}
                                    isSelected={selectedResourceIdentifiers.includes(
                                        key
                                    )}
                                    onChangeSelect={onSelectHandlers[key]}
                                />
                            ))}
                        </Tbody>
                    </Table>
                </ResourceContextMenu>
            </ScrollBoxHorizontalScroll>
        </Box>
    );
};

type ResourceRowProps = {
    resource: K8sObject;
    showNamespace: boolean;
    customDetails: ResourceDetail[];
    isSelected?: boolean;
    onChangeSelect?: (selected: boolean) => void;
};

const ResourceRow: React.FC<ResourceRowProps> = (props) => {
    const {
        resource,
        isSelected,
        onChangeSelect,
        showNamespace,
        customDetails,
    } = props;

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
    const customColumns = useMemo(
        () => customDetails.filter(isResourceColumn),
        [customDetails]
    );

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
                        <Selectable>{col.valueFor(resource)}</Selectable>
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
