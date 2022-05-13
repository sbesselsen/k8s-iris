import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Badge,
    Box,
    BoxProps,
    Checkbox,
    Heading,
    HStack,
    List,
    ListItem,
    Text,
    useColorModeValue,
    useControllableState,
    VStack,
} from "@chakra-ui/react";
import React, { createContext, useCallback, useContext, useMemo } from "react";
import { K8sObject } from "../../../common/k8s/client";
import { Datetime } from "../main/Datetime";
import { Defer } from "../main/Defer";
import { Selectable } from "../main/Selectable";

export type K8sResourceDisplayRule = {
    selector: string;
    displayAs?: "auto" | "accordion" | "string-key-pair" | "hidden";
    autoExpandSingleItem?: boolean;
    keysOrder?: string[];
    subKeyField?: string;
    keyValueSeparator?: string;
};

export type K8sObjectViewerProps = {
    data: any;
    displayRules?: K8sResourceDisplayRule[];
    expandedItems?: string[];
    onChangeExpandedItems?: (items: string[]) => void;
    defaultExpandedItems?: string[];
};

type K8sObjectViewerContext = {
    displayRulesMap: Record<string, K8sResourceDisplayRule>;
    expandedKeysForPath(path: string): [string[], (keys: string[]) => void];
};

const K8sObjectViewerContext = createContext<K8sObjectViewerContext>({
    displayRulesMap: {},
    expandedKeysForPath: () => [[], () => {}],
});

export const K8sObjectViewer: React.FC<K8sObjectViewerProps> = (props) => {
    const { data, displayRules } = props;

    const [expandedItems, setExpandedItems] = useControllableState({
        value: props.expandedItems,
        onChange: props.onChangeExpandedItems,
        defaultValue: props.defaultExpandedItems ?? [],
    });

    const displayRulesMap = useMemo(
        () =>
            Object.fromEntries(
                displayRules.map((rule) => [rule.selector, rule])
            ),
        [displayRules]
    );

    const ctx: K8sObjectViewerContext = useMemo(() => {
        return {
            displayRulesMap,
            expandedKeysForPath(path: string) {
                const prefix = `${path}::`;
                return [
                    expandedItems
                        .filter((item) => item.startsWith(prefix))
                        .map((x) => x.substring(prefix.length)),
                    (items: string[]) => {
                        setExpandedItems((expandedItems) => [
                            ...expandedItems.filter(
                                (item) => !item.startsWith(prefix)
                            ),
                            ...items.map((item) => prefix + item),
                        ]);
                    },
                ];
            },
        };
    }, [displayRulesMap, expandedItems, setExpandedItems]);

    return (
        <K8sObjectViewerContext.Provider value={ctx}>
            <K8sInnerObjectViewer data={data} path="." selector="." />
        </K8sObjectViewerContext.Provider>
    );
};

export type K8sInnerObjectViewerProps = {
    data: any;
    path: string;
    selector: string;
};

const defaultDisplayRule: K8sResourceDisplayRule = {
    selector: "",
    displayAs: "auto",
    autoExpandSingleItem: false,
};

const sortOptions = {
    sensitivity: "base",
    numeric: true,
    ignorePunctuation: true,
};

export const K8sInnerObjectViewer: React.FC<K8sInnerObjectViewerProps> = (
    props
) => {
    const { data, path, selector } = props;

    const { displayRulesMap } = useContext(K8sObjectViewerContext);

    const displayRule = useMemo(
        () => calcDisplayRule(selector, displayRulesMap),
        [selector, displayRulesMap]
    );

    const emptyTextColor = useColorModeValue("gray.500", "gray.500");

    const isSimple = isSimpleValue(data);
    const arrayIsSimple = useMemo(
        () => Array.isArray(data) && isSimpleArray(data),
        [data]
    );
    const keyField = useMemo(
        () =>
            Array.isArray(data) && !arrayIsSimple
                ? displayRule.subKeyField ?? detectKeyField(data)
                : undefined,
        [arrayIsSimple, displayRule, data]
    );

    if (displayRule.displayAs === "hidden") {
        return null;
    }

    if (isSimple) {
        const isEmpty =
            data === "" ||
            data === null ||
            data === undefined ||
            (typeof data === "object" && Object.keys(data).length === 0);
        const isBoolean = typeof data === "boolean";
        let isTimestamp = false;
        let timestamp: number | undefined;
        if (String(data).match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/)) {
            timestamp = Date.parse(String(data));
            isTimestamp = !isNaN(timestamp);
        }
        return (
            <Selectable
                fontSize="sm"
                display="block"
                isTruncated
                {...(isEmpty ? { textColor: emptyTextColor } : {})}
            >
                {isEmpty && "(empty)"}
                {isBoolean && (
                    <Checkbox isChecked={data} colorScheme="primary" readOnly />
                )}
                {isTimestamp && <Datetime value={timestamp} />}
                {!isEmpty && !isBoolean && !isTimestamp && String(data)}
            </Selectable>
        );
    }
    if (Array.isArray(data)) {
        if (data.length === 0) {
            <Selectable
                fontSize="sm"
                display="block"
                textColor={emptyTextColor}
                isTruncated
            >
                (empty list)
            </Selectable>;
        }
        if (arrayIsSimple) {
            // Show a basic list.
            return (
                <List>
                    {data.map((value, index) => (
                        <ListItem key={index}>
                            <K8sInnerObjectViewer
                                data={value}
                                path={mergePath(path, index)}
                                selector={selector}
                            />
                        </ListItem>
                    ))}
                </List>
            );
        }
    }

    if (!data) {
        return null;
    }

    let entries = Object.entries(data);
    if (entries.length === 0) {
        return null;
    }

    // Sort the entries.
    if (displayRule.keysOrder) {
        sortEntriesByKeysOrder(entries, displayRule.keysOrder);
    }

    if (displayRule.displayAs === "string-key-pair") {
        return (
            <List>
                {Object.entries(data).map(([key, value]) => (
                    <ListItem key={key}>
                        <Selectable fontSize="sm" display="block" isTruncated>
                            <Text
                                fontWeight="semibold"
                                display="inline"
                                userSelect="inherit"
                            >
                                {key}
                            </Text>
                            {displayRule.keyValueSeparator ?? ": "}
                            {value}
                        </Selectable>
                    </ListItem>
                ))}
            </List>
        );
    }

    if (displayRule.displayAs === "accordion") {
        return (
            <K8sObjectAccordion
                path={path}
                items={entries.map(([key, item]) => ({
                    key,
                    item,
                    path: mergePath(path, key),
                    selector: mergePath(selector, key),
                }))}
            />
        );
    }

    return (
        <K8sObjectMap
            items={flattenObjectMapEntries(
                entries.map(([key, item]) => ({
                    title: key,
                    item,
                    path: mergePath(path, key),
                    selector: mergePath(selector, key),
                }))
            )}
        />
    );
};

function mergePath(path: string, subPath: string | number): string {
    return path === "." ? path + subPath : path + "." + subPath;
}

function sortEntriesByKeysOrder<T>(
    entries: [string, T][],
    keysOrder: string[]
): void {
    const keysIndexes: Record<string, number> = Object.fromEntries(
        keysOrder.map((key, index) => [key, index])
    );
    const defaultKeyIndex = keysIndexes["*"] ?? keysOrder.length;
    entries.sort(([k1], [k2]) => {
        const key1Index = keysIndexes[k1] ?? defaultKeyIndex;
        const key2Index = keysIndexes[k2] ?? defaultKeyIndex;
        if (key1Index === key2Index) {
            return k1.localeCompare(k2, undefined, sortOptions);
        }
        return key1Index - key2Index;
    });
}

type SimpleValue = string | number | boolean | null | undefined;

type ObjectMapEntry = {
    title: string;
    path: string;
    item: any;
    selector: string;
};

type K8sObjectMapProps = {
    items: ObjectMapEntry[];
};

function flattenObjectMapEntries(entries: ObjectMapEntry[]): ObjectMapEntry[] {
    const output: ObjectMapEntry[] = [];
    for (let entry of entries) {
        if (Array.isArray(entry.item) && !isSimpleArray(entry.item)) {
            // We need to flatten this item.
            for (let i = 0; i < entry.item.length; i++) {
                output.push({
                    title: `${entry.title}[${i}]`,
                    path: mergePath(entry.path, i),
                    item: entry.item[i],
                    selector: entry.selector,
                });
            }
        } else {
            output.push(entry);
        }
    }
    return output;
}

const K8sObjectMap: React.FC<K8sObjectMapProps> = (props) => {
    const { items } = props;
    const { displayRulesMap } = useContext(K8sObjectViewerContext);
    return (
        <VStack spacing={3} alignItems="stretch">
            {items.map(({ title, path, selector, item }) => {
                const isSimple = isSimpleValue(item);
                const displayRule = calcDisplayRule(selector, displayRulesMap);

                if (displayRule.displayAs === "hidden") {
                    return null;
                }
                const shouldIncludeMargin =
                    !isSimple && displayRule.displayAs !== "string-key-pair";

                let displayTitle = title.replace(
                    /([a-z])([A-Z])/g,
                    (_, l, r) => `${l} ${r}`
                );
                let displayValue = item;
                if (
                    displayRule.autoExpandSingleItem &&
                    Array.isArray(item) &&
                    item.length === 1 &&
                    !isSimpleArray(item)
                ) {
                    displayValue = item[0];
                    displayTitle += "[0]";
                }

                const valueViewer = (
                    <K8sInnerObjectViewer
                        data={displayValue}
                        path={path}
                        selector={selector}
                    />
                );
                return (
                    <Box key={path}>
                        <PropHeading>{displayTitle}</PropHeading>
                        <Box
                            mt={shouldIncludeMargin ? 2 : 0}
                            ps={shouldIncludeMargin ? 4 : 0}
                        >
                            {valueViewer}
                        </Box>
                    </Box>
                );
            })}
        </VStack>
    );
};

type K8sObjectAccordionProps = {
    items: Array<{ key: string; path: string; item: any; selector: string }>;
    path: string;
};

const K8sObjectAccordion: React.FC<K8sObjectAccordionProps> = (props) => {
    const { items, path } = props;
    const { displayRulesMap } = useContext(K8sObjectViewerContext);

    const displayRules = useMemo(
        () =>
            items.map(({ selector }) =>
                calcDisplayRule(selector, displayRulesMap)
            ),
        [items, displayRulesMap]
    );
    const displayableItems = items.filter(
        (_, index) => displayRules[index].displayAs !== "hidden"
    );

    const [expandedKeys, setExpandedKeys] = useContext(
        K8sObjectViewerContext
    ).expandedKeysForPath(path);

    const indexes = displayableItems
        .map((item, index) => (expandedKeys.includes(item.key) ? index : -1))
        .filter((x) => x !== -1);
    const onChangeIndexes = useCallback(
        (indexes: number | number[]) => {
            const indexesArray = Array.isArray(indexes) ? indexes : [indexes];
            setExpandedKeys(
                indexesArray.map((index) => displayableItems[index]?.key)
            );
        },
        [displayableItems, setExpandedKeys]
    );

    return (
        <Accordion allowMultiple index={indexes} onChange={onChangeIndexes}>
            {displayableItems.map(({ key, item, path, selector }, index) => {
                return (
                    <AccordionItem key={key}>
                        <Heading>
                            <AccordionButton
                                ps={0}
                                fontSize="xs"
                                fontWeight="semibold"
                                textColor="primary.500"
                                textTransform="uppercase"
                            >
                                <AccordionIcon />
                                {key}
                            </AccordionButton>
                        </Heading>
                        <AccordionPanel ps={4}>
                            <Defer initialize={indexes.includes(index)}>
                                <K8sInnerObjectViewer
                                    data={item}
                                    path={path}
                                    selector={selector}
                                />
                            </Defer>
                        </AccordionPanel>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
};

function calcDisplayRule(
    path: string,
    rulesMap: Record<string, K8sResourceDisplayRule>
): K8sResourceDisplayRule {
    const cacheKey = `cache:${path}`;
    if (rulesMap[cacheKey]) {
        return rulesMap[cacheKey];
    }
    const pathOptions = [path.replace(/^.*\.([^\.]+)/, "..$1"), path];
    let rule = defaultDisplayRule;
    for (const pathOption of pathOptions) {
        if (rulesMap[pathOption]) {
            rule = { ...rule, ...rulesMap[pathOption] };
        }
    }
    rulesMap[cacheKey] = rule;
    return rule;
}

export type K8sObjectHeadingProps = BoxProps & {
    apiVersion: string | undefined;
    kind: string | undefined;
    metadata: K8sObject["metadata"];
};

export const K8sObjectHeading: React.FC<K8sObjectHeadingProps> = (props) => {
    const { apiVersion, kind, metadata, ...boxProps } = props;
    return (
        <VStack alignItems="start" {...boxProps}>
            <Heading fontSize="md" fontWeight="semibold">
                <Selectable isTruncated>
                    {kind && (
                        <Text fontWeight="bold" display="inline">
                            {kind}:{" "}
                        </Text>
                    )}{" "}
                    {metadata.name}
                </Selectable>
            </Heading>
            <HStack alignItems="baseline">
                {apiVersion && <Badge>{apiVersion}</Badge>}
                {metadata?.namespace && <Badge>{metadata?.namespace}</Badge>}
            </HStack>
        </VStack>
    );
};

function detectKeyField<T>(items: T[]): keyof T | undefined {
    let possibleKeyFields = [
        "name",
        "id",
        "key",
        "type",
        "host",
        "path",
        "hostname",
    ];
    const keyValues: Record<string, string[]> = {};

    for (const item of items) {
        if (typeof item !== "object") {
            return undefined;
        }
        possibleKeyFields = possibleKeyFields.filter((field) => {
            if (!(field in item)) {
                return false;
            }
            const value = item[field];
            if (field in keyValues && keyValues[field].includes(value)) {
                // Duplicate value; this is not a suitable key field.
                return false;
            }
            if (!keyValues[field]) {
                keyValues[field] = [];
            }
            keyValues[field].push(value);
            return true;
        });
        if (possibleKeyFields.length === 0) {
            break;
        }
    }
    return possibleKeyFields[0] as any;
}

function isSimpleValue(obj: any): obj is SimpleValue {
    if (!obj) {
        return true;
    }
    if (Array.isArray(obj)) {
        return false;
    }
    if (typeof obj !== "object") {
        return true;
    }
    return Object.keys(obj).length === 0;
}

function isSimpleArray(obj: any[]): obj is SimpleValue[] {
    return obj.length > 0 && obj.every(isSimpleValue);
}

const PropHeading: React.FC<{}> = ({ children, ...props }) => {
    return (
        <Heading
            fontSize="xs"
            fontWeight="semibold"
            textColor="primary.500"
            textTransform="uppercase"
            {...props}
        >
            <Selectable>{children}</Selectable>
        </Heading>
    );
};
