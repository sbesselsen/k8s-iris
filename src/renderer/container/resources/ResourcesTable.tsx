import {
    Badge,
    Checkbox,
    HStack,
    Table,
    TableCellProps,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";
import React, { ChangeEvent, useCallback, useMemo } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { reuseShallowEqualArray } from "../../../common/util/deep-equal";
import { k8sSmartCompare } from "../../../common/util/sort";
import { ScrollBoxHorizontalScroll } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import {
    generateResourceDetails,
    isResourceBox,
    isResourceColumn,
    ResourceColumn,
    ResourceDetail,
} from "../../k8s/details";
import { formatDeveloperDateTime } from "../../util/date";
import { ReadableStore, useProvidedStoreValue } from "../../util/state";
import { ResourceEditorLink } from "./ResourceEditorLink";

export type ResourcesTableStoreValue = {
    identifiers: Set<string>;
    resources: Record<string, K8sObject>;
};

export type ResourceTableProps = {
    selectedKeysStore: ReadableStore<Set<string>>;
    onChangeSelectedKeys: (keys: Record<string, boolean>) => void;
    resourcesStore: ReadableStore<ResourcesTableStoreValue>;
    showNamespace: boolean;
};

export const ResourcesTable: React.FC<ResourceTableProps> = (props) => {
    const {
        onChangeSelectedKeys,
        resourcesStore,
        selectedKeysStore,
        showNamespace,
    } = props;

    // TODO: multi-select, in some better way too

    const keys: string[] = useProvidedStoreValue(
        resourcesStore,
        ({ identifiers, resources }, _prevValue, prevReturnValue) => {
            return reuseShallowEqualArray(
                [...identifiers].sort((k1, k2) =>
                    k8sSmartCompare(
                        resources[k1].metadata.name,
                        resources[k2].metadata.name
                    )
                ),
                prevReturnValue ?? []
            );
        }
    );

    const numSelectedKeys = useProvidedStoreValue(
        selectedKeysStore,
        (selected) => keys.filter((key) => selected.has(key)).length,
        [keys]
    );

    const allResourcesSelected =
        numSelectedKeys > 0 && numSelectedKeys === keys.length;
    const someResourcesSelected =
        numSelectedKeys > 0 && numSelectedKeys < keys.length;

    const onChangeSelectAll = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const checked = e.target.checked;
            onChangeSelectedKeys(
                Object.fromEntries(keys.map((key) => [key, checked]))
            );
        },
        [keys, onChangeSelectedKeys]
    );

    const resourceTypesString = useProvidedStoreValue(
        resourcesStore,
        ({ identifiers, resources }) =>
            [
                ...new Set(
                    [...identifiers]
                        .map((key) => resources[key])
                        .map((r) => `${r.apiVersion}:${r.kind}`)
                ),
            ]
                .sort()
                .join(",")
    );

    // Bit weird but it prevents unnecessary rerenders of the columns and, well, why not.
    const resourceTypes: K8sResourceTypeIdentifier[] = useMemo(
        () =>
            resourceTypesString === ""
                ? []
                : resourceTypesString.split(",").map((t) => {
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
        <ScrollBoxHorizontalScroll>
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
                    {keys.map((key) => (
                        <ResourcesTableRow
                            resourcesStore={resourcesStore}
                            resourceKey={key}
                            showNamespace={showNamespace}
                            customDetails={customDetails}
                            selectedKeysStore={selectedKeysStore}
                            onChangeSelectedKeys={onChangeSelectedKeys}
                            key={key}
                        />
                    ))}
                </Tbody>
            </Table>
        </ScrollBoxHorizontalScroll>
    );
};

type ResourcesTableRowProps = {
    selectedKeysStore: ReadableStore<Set<string>>;
    onChangeSelectedKeys: (keys: Record<string, boolean>) => void;
    resourcesStore: ReadableStore<ResourcesTableStoreValue>;
    resourceKey: string;
    showNamespace: boolean;
    customDetails: ResourceDetail[];
};

const ResourcesTableRow: React.FC<ResourcesTableRowProps> = React.memo(
    (props) => {
        const {
            selectedKeysStore,
            onChangeSelectedKeys,
            resourcesStore,
            resourceKey,
            showNamespace,
            customDetails,
        } = props;

        const resource = useProvidedStoreValue(
            resourcesStore,
            ({ resources }) => resources[resourceKey],
            [resourceKey]
        );
        const isSelected = useProvidedStoreValue(
            selectedKeysStore,
            (selected) => selected.has(resourceKey),
            [resourceKey]
        );

        const creationDate = new Date(
            (resource as any).metadata.creationTimestamp
        );
        const isDeleting = Boolean(
            (resource as any).metadata.deletionTimestamp
        );

        const onChange = useCallback(
            (e: ChangeEvent<HTMLInputElement>) => {
                onChangeSelectedKeys({ [resourceKey]: e.target.checked });
            },
            [onChangeSelectedKeys, resourceKey]
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
                                2 +
                                (showNamespace ? 1 : 0) +
                                customColumns.length
                            }
                        >
                            {box.value}
                        </Td>
                    </Tr>
                ))}
            </>
        );
    }
);
