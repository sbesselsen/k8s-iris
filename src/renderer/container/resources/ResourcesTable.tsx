import {
    Badge,
    Box,
    Checkbox,
    Heading,
    HStack,
    Table,
    TableCellProps,
    Td,
    Th,
    Thead,
    Tr,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { reuseShallowEqualArray } from "../../../common/util/deep-equal";
import {
    applyMutations,
    difference,
    intersection,
} from "../../../common/util/set";
import { resourceMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { Selectable } from "../../component/main/Selectable";
import { useAppSearch } from "../../context/search";
import { useGuaranteedMemo } from "../../hook/guaranteed-memo";
import { useModifierKeyRef } from "../../hook/keyboard";
import { createMultiSelectProcessor } from "../../hook/multi-select";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import {
    generateResourceDetails,
    isResourceBox,
    isResourceColumn,
    ResourceColumn,
    ResourceDetail,
} from "../../k8s/details";
import { formatDeveloperDateTime } from "../../util/date";
import {
    createStore,
    ReadableStore,
    useCombinedReadableStore,
    useDerivedReadableStore,
    useProvidedStoreValue,
} from "../../util/state";
import { ResourceEditorLink } from "./ResourceEditorLink";
import { ViewportLazyTbody } from "../../component/main/ViewportLazyTbody";

export type ResourcesTableStoreValue = {
    identifiers: Set<string>;
    resources: Record<string, K8sObject>;
};

const emptySelectedKeysStore = createStore(new Set<string>());
const emptyOnChangeSelectedKeys = () => {};

export type ResourcesTableProps = {
    selectedKeysStore?: ReadableStore<Set<string>>;
    onChangeSelectedKeys?: (keys: Record<string, boolean>) => void;
    resourcesStore: ReadableStore<ResourcesTableStoreValue>;
    showNamespace: boolean;
    showSelect?: boolean;
};

export const ResourcesTable: React.FC<ResourcesTableProps> = (props) => {
    const {
        onChangeSelectedKeys:
            baseOnChangeSelectedKeys = emptyOnChangeSelectedKeys,
        resourcesStore,
        selectedKeysStore = emptySelectedKeysStore,
        showNamespace,
        showSelect = true,
    } = props;

    const { query } = useAppSearch();

    const keys: string[] = useProvidedStoreValue(
        resourcesStore,
        ({ identifiers, resources }, _prevValue, prevReturnValue) => {
            let identifiersArray: string[] = [...identifiers];
            if (query) {
                identifiersArray = identifiersArray.filter((key) =>
                    resourceMatch(query, resources[key])
                );
            }
            return reuseShallowEqualArray(
                identifiersArray.sort((k1, k2) =>
                    k8sSmartCompare(
                        resources[k1].metadata.name,
                        resources[k2].metadata.name
                    )
                ),
                prevReturnValue ?? []
            );
        },
        [query]
    );

    const multiSelectProcessor = useGuaranteedMemo(
        () => createMultiSelectProcessor(keys),
        [keys]
    );
    const prevSelectionRef = useRef<Set<string>>(new Set());
    const shiftKeyRef = useModifierKeyRef("Shift");
    const onChangeSelectedKeys = useCallback(
        (keys: Record<string, boolean>) => {
            const scopedIdentifiers = resourcesStore.get().identifiers;

            const newSelection = applyMutations(selectedKeysStore.get(), keys);
            const expandedSelection = multiSelectProcessor(
                newSelection,
                selectedKeysStore.get(),
                shiftKeyRef.current
            );
            const expandedKeys = { ...keys };
            for (const addedKey of difference(
                expandedSelection,
                newSelection
            )) {
                expandedKeys[addedKey] = true;
            }
            for (const removedKey of intersection(
                difference(newSelection, expandedSelection),
                scopedIdentifiers
            )) {
                expandedKeys[removedKey] = false;
            }
            baseOnChangeSelectedKeys(expandedKeys);
        },
        [
            baseOnChangeSelectedKeys,
            prevSelectionRef,
            multiSelectProcessor,
            resourcesStore,
            selectedKeysStore,
            shiftKeyRef,
        ]
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

    const customDetails = useMemo(() => {
        const details = new Map<string, ResourceDetail>();
        for (const type of resourceTypes) {
            for (const detail of generateResourceDetails(type)) {
                details.set(detail.id, detail);
            }
        }
        return [...details.values()];
    }, [resourceTypes]);
    const customColumns = useMemo(
        () => customDetails.filter(isResourceColumn),
        [customDetails]
    );

    function detailColWidth(col: ResourceColumn): number {
        return 40 * (col.widthUnits + 1);
    }

    const nameColumnMiniWidthThreshold = 150;

    const selectColumnWidth = 40;
    const customColumnWidths = customColumns.map((c) => detailColWidth(c));
    const customColumnTotalWidth = customColumnWidths.reduce(
        (x, y) => x + y,
        0
    );
    const namespaceColumnWidth = 150;
    const createdColumnWidth = 120;

    // Calculate the width of the non-name columns.
    const nonNameColumnWidth =
        (showSelect ? selectColumnWidth : 0) +
        customColumnTotalWidth +
        (showNamespace ? namespaceColumnWidth : 0) +
        createdColumnWidth;

    const [isMini, setIsMini] = useState(true);

    const tableRef = useRef<HTMLTableElement | null>(null);
    useLayoutEffect(() => {
        const elem = tableRef.current;
        if (!elem) {
            return;
        }
        const resizeObserver = new ResizeObserver((entries) => {
            const width = entries[0]?.borderBoxSize[0]?.inlineSize;
            if (width !== undefined) {
                const nameColumnWidth = width - nonNameColumnWidth;
                const shouldBeMini =
                    nameColumnWidth < nameColumnMiniWidthThreshold;
                if (isMini !== shouldBeMini) {
                    setIsMini(shouldBeMini);
                }
            }
        });
        resizeObserver.observe(elem);
        return () => {
            resizeObserver.disconnect();
        };
    }, [
        isMini,
        nameColumnMiniWidthThreshold,
        nonNameColumnWidth,
        setIsMini,
        tableRef,
    ]);

    return (
        <Table ref={tableRef} size="sm" sx={{ tableLayout: "fixed" }}>
            <Thead>
                <Tr>
                    {showSelect && (
                        <Th ps={2} width={`${selectColumnWidth}px`}>
                            <ResourceTableSelectAll
                                keys={keys}
                                selectedKeysStore={selectedKeysStore}
                                onChangeSelectedKeys={baseOnChangeSelectedKeys}
                            />
                        </Th>
                    )}

                    <Th ps={showSelect ? 0 : 2} whiteSpace="nowrap">
                        Name
                    </Th>
                    {!isMini &&
                        customColumns.map((col, index) => (
                            <Th
                                key={col.id}
                                width={`${customColumnWidths[index]}px`}
                            >
                                {col.header}
                            </Th>
                        ))}
                    {!isMini && showNamespace && (
                        <Th width={`${namespaceColumnWidth}px`}>Namespace</Th>
                    )}
                    {!isMini && (
                        <Th width={`${createdColumnWidth}px`}>Created</Th>
                    )}
                </Tr>
            </Thead>
            <ViewportLazyTbody
                chunkSize={10}
                rootMargin="1000px"
                defaultHeight="30px"
            >
                {keys.map((key) => (
                    <ResourcesTableRow
                        resourcesStore={resourcesStore}
                        resourceKey={key}
                        showNamespace={showNamespace}
                        customDetails={customDetails}
                        selectedKeysStore={selectedKeysStore}
                        onChangeSelectedKeys={onChangeSelectedKeys}
                        showSelect={showSelect}
                        isMini={isMini}
                        key={key}
                    />
                ))}
            </ViewportLazyTbody>
        </Table>
    );
};

type ResourceTableSelectAllProps = {
    keys: string[];
    selectedKeysStore: ReadableStore<Set<string>>;
    onChangeSelectedKeys: (keys: Record<string, boolean>) => void;
};

const ResourceTableSelectAll: React.FC<ResourceTableSelectAllProps> = (
    props
) => {
    const { keys, selectedKeysStore, onChangeSelectedKeys } = props;

    const allResourcesSelected = useProvidedStoreValue(
        selectedKeysStore,
        (selected) => keys.length > 0 && keys.every((key) => selected.has(key)),
        [keys]
    );
    const someResourcesSelected = useProvidedStoreValue(
        selectedKeysStore,
        (selected) => {
            const selectedKeys = keys.filter((key) => selected.has(key)).length;
            return selectedKeys > 0 && selectedKeys < keys.length;
        },
        [keys]
    );

    const onChangeSelectAll = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const checked = e.target.checked;
            onChangeSelectedKeys(
                Object.fromEntries(keys.map((key) => [key, checked]))
            );
        },
        [keys, onChangeSelectedKeys]
    );

    return (
        <Checkbox
            colorScheme="gray"
            isIndeterminate={someResourcesSelected}
            isChecked={allResourcesSelected}
            onChange={onChangeSelectAll}
        />
    );
};

type ResourcesTableRowProps = {
    selectedKeysStore: ReadableStore<Set<string>>;
    onChangeSelectedKeys: (keys: Record<string, boolean>) => void;
    resourcesStore: ReadableStore<ResourcesTableStoreValue>;
    resourceKey: string;
    showNamespace: boolean;
    showSelect: boolean;
    customDetails: ResourceDetail[];
    isMini: boolean;
};

const ResourcesTableRow: React.FC<ResourcesTableRowProps> = React.memo(
    (props) => {
        return props.isMini ? (
            <ResourcesTableMiniRow {...props} />
        ) : (
            <ResourcesTableFullRow {...props} />
        );
    }
);

const ResourcesTableFullRow: React.FC<ResourcesTableRowProps> = React.memo(
    (props) => {
        const {
            selectedKeysStore,
            onChangeSelectedKeys,
            resourcesStore,
            resourceKey,
            showNamespace,
            showSelect,
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
                    {showSelect && (
                        <Td {...commonTdProps} ps={2} verticalAlign="baseline">
                            <Checkbox
                                isChecked={isSelected}
                                onChange={onChange}
                            />
                        </Td>
                    )}

                    <Td
                        {...commonTdProps}
                        ps={showSelect ? 0 : 2}
                        verticalAlign="baseline"
                        userSelect="text"
                    >
                        <HStack p={0}>
                            <ResourceEditorLink
                                userSelect="text"
                                cursor="inherit"
                                textColor={isDeleting ? "gray.500" : ""}
                                editorResource={resource}
                            >
                                {resource.metadata.name}
                            </ResourceEditorLink>
                            <ResourceTableRowBadges badges={badges} />
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

const ResourcesTableMiniRow: React.FC<ResourcesTableRowProps> = React.memo(
    (props) => {
        const {
            selectedKeysStore,
            onChangeSelectedKeys,
            resourcesStore,
            resourceKey,
            showNamespace,
            showSelect,
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

        const stats = useMemo(
            () => [
                ...(showNamespace
                    ? [
                          {
                              id: "namespace",
                              header: "Namespace",
                              valueFor: () => {
                                  return resource.metadata.namespace;
                              },
                              style: "column",
                              widthUnits: 1,
                          },
                      ]
                    : []),
                ...customColumns,
                {
                    id: "created",
                    header: "Created",
                    valueFor: () => {
                        return formatDeveloperDateTime(creationDate);
                    },
                    style: "column",
                    widthUnits: 1,
                },
            ],
            [creationDate, customColumns, resource, showNamespace]
        );

        return (
            <>
                <Tr>
                    {showSelect && (
                        <Td {...commonTdProps} ps={2} verticalAlign="baseline">
                            <Checkbox
                                isChecked={isSelected}
                                onChange={onChange}
                            />
                        </Td>
                    )}

                    <Td
                        {...commonTdProps}
                        ps={showSelect ? 0 : 2}
                        verticalAlign="baseline"
                        userSelect="text"
                    >
                        <VStack p={0} alignItems="stretch">
                            <HStack p={0}>
                                <ResourceEditorLink
                                    userSelect="text"
                                    cursor="inherit"
                                    textColor={isDeleting ? "gray.500" : ""}
                                    editorResource={resource}
                                >
                                    {resource.metadata.name}
                                </ResourceEditorLink>
                                <ResourceTableRowBadges badges={badges} />
                            </HStack>
                            <VStack spacing={0} alignItems="stretch">
                                {stats.length > 0 && (
                                    <Box>
                                        {stats.map((col) => {
                                            return (
                                                <VStack
                                                    key={col.id}
                                                    display="inline-flex"
                                                    alignItems="stretch"
                                                    spacing={0}
                                                    me={6}
                                                    mb={1}
                                                >
                                                    <Heading
                                                        fontSize="xs"
                                                        textTransform="uppercase"
                                                        textColor="gray"
                                                    >
                                                        {col.header}
                                                    </Heading>
                                                    <Box fontSize="xs">
                                                        <Selectable display="block">
                                                            {col.valueFor(
                                                                resource
                                                            ) ?? "-"}
                                                        </Selectable>
                                                    </Box>
                                                </VStack>
                                            );
                                        })}
                                    </Box>
                                )}
                                {customBoxes.map((col) => (
                                    <VStack
                                        key={col.id}
                                        display="inline-flex"
                                        alignItems="stretch"
                                        spacing={0}
                                        mb={1}
                                    >
                                        <Heading
                                            fontSize="xs"
                                            textTransform="uppercase"
                                            textColor="gray"
                                        >
                                            {col.header}
                                        </Heading>
                                        <Box fontSize="xs" isTruncated>
                                            {col.valueFor(resource) ?? "-"}
                                        </Box>
                                    </VStack>
                                ))}
                            </VStack>
                        </VStack>
                    </Td>
                </Tr>
            </>
        );
    }
);

const ResourceTableRowBadges: React.FC<{ badges: ResourceBadge[] }> = (
    props
) => {
    const { badges } = props;
    return (
        <>
            {badges.map((badge) => {
                const { id, text, variant, details, badgeProps } = badge;
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
        </>
    );
};

export function useFilteredResourceTableStore<T>(
    store: ReadableStore<ResourcesTableStoreValue>,
    filterStore: ReadableStore<T>,
    filter: (obj: K8sObject, filterValue: T) => boolean,
    deps?: any[]
): ReadableStore<ResourcesTableStoreValue> {
    return useDerivedReadableStore(
        useCombinedReadableStore(store, filterStore),
        ([data, filterValue]) => {
            const resources: Record<string, K8sObject> = data.resources;
            let identifiers = data.identifiers;
            if (filterValue !== undefined) {
                identifiers = new Set(
                    [...identifiers].filter((key) => {
                        const resource = resources[key];
                        if (!resource) {
                            return false;
                        }
                        return filter(resource, filterValue);
                    })
                );
            }
            return {
                identifiers,
                resources,
            };
        },
        deps ?? []
    );
}
