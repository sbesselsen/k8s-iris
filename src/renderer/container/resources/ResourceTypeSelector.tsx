import { ChevronDownIcon } from "@chakra-ui/icons";
import {
    Button,
    ButtonGroup,
    HStack,
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuList,
    useControllableState,
    useDisclosure,
    useToken,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    ReactNode,
    useCallback,
    useMemo,
    useState,
} from "react";
import {
    K8sResourceTypeIdentifier,
    K8sResourceTypeInfo,
} from "../../../common/k8s/client";
import { searchMatch } from "../../../common/util/search";
import { MenuInput } from "../../component/MenuInput";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";

export type ResourceTypeSelectorProps = {
    value?: K8sResourceTypeIdentifier | null;
    onChange?: (
        value: K8sResourceTypeIdentifier | null,
        requestNewWindow: boolean
    ) => void;
    emptyValueContent?: ReactNode;
};

function apiGroup(apiVersion: string): string {
    return apiVersion.indexOf("/") > -1 ? apiVersion.split("/", 2)[0] : "";
}

const sortOptions = {
    sensitivity: "base",
    numeric: true,
    ignorePunctuation: true,
};

export const ResourceTypeSelector: React.FC<ResourceTypeSelectorProps> = (
    props
) => {
    const { value, onChange, emptyValueContent = "" } = props;

    const [stateValue, setStateValue] = useControllableState({
        value,
        onChange: onChange as any,
    });

    const [_isLoadingResourceTypes, resourceTypes, _resourceTypesError] =
        useK8sApiResourceTypes();

    const metaKeyPressedRef = useModifierKeyRef("Meta");
    const [searchValue, setSearchValue] = useState("");
    const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();

    const selectValue = useCallback(
        (type: K8sResourceTypeIdentifier | null) => {
            if (metaKeyPressedRef.current) {
                onChange(type, true);
            } else {
                setStateValue(type);
            }
        },
        [metaKeyPressedRef, onChange, setStateValue]
    );

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
                selectValue(type);
            }),
        [selectValue, versionedTypes]
    );

    const onSelectType = useCallback(
        (type: ProcessedResourceType) => {
            selectValue(type.types[type.types.length - 1]);
            onClose();
        },
        [onClose, selectValue]
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

    const stateValueSuffix = useMemo(() => {
        if (!stateValue) {
            return null;
        }
        if (
            processedResourceTypes?.filter((pt) => pt.kind === stateValue.kind)
                .length > 1
        ) {
            return apiGroup(stateValue.apiVersion) || "core";
        }
    }, [processedResourceTypes, stateValue]);

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
                            {stateValue.kind}
                            {stateValueSuffix ? ` (${stateValueSuffix})` : ""}
                        </>
                    ) : (
                        emptyValueContent
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
