import {
    Box,
    Button,
    ButtonGroup,
    Checkbox,
    CheckboxGroup,
    Collapse,
    Heading,
    Icon,
    useColorModeValue,
    HStack,
    VStack,
    useToken,
} from "@chakra-ui/react";
import React, {
    ElementType,
    Fragment,
    MouseEvent,
    ReactNode,
    useCallback,
    useMemo,
} from "react";
import { K8sObject } from "../../../common/k8s/client";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { searchMatch } from "../../../common/util/search";
import { useAppSearch } from "../../context/search";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useMultiSelectUpdater } from "../../hook/multi-select";
import { useWindowFocusValue } from "../../hook/window-focus";

export type SidebarMainMenuItem = {
    id: string;
    iconType?: ElementType;
    title: ReactNode;
};

export type SidebarMainMenuProps = {
    items: SidebarMainMenuItem[];
    selection?: string | undefined;
    onChangeSelection?: (selection: string, requestNewWindow?: boolean) => void;
};

export const SidebarMainMenu: React.FC<SidebarMainMenuProps> = (props) => {
    const { items, selection, onChangeSelection } = props;

    const opacity = useWindowFocusValue(1.0, 0.5);

    const metaKeyRef = useModifierKeyRef("Meta");

    const onClickMenuItems = useMemo(
        () =>
            Object.fromEntries(
                items.map((item) => [
                    item.id,
                    () => {
                        onChangeSelection?.(item.id, metaKeyRef.current);
                    },
                ])
            ),
        [items, metaKeyRef, onChangeSelection]
    );

    return (
        <VStack mt={2} mx={2} spacing={0} opacity={opacity}>
            {items.map((item) => (
                <SidebarMenuButton
                    key={item.id}
                    item={item}
                    onSelect={onClickMenuItems[item.id]}
                    isSelected={item.id && item.id === selection}
                />
            ))}
        </VStack>
    );
};

type SidebarMenuButtonProps = {
    item: SidebarMainMenuItem;
    isSelected?: boolean;
    onSelect?: () => void;
};

const SidebarMenuButton: React.FC<SidebarMenuButtonProps> = (props) => {
    const { item, isSelected = false, onSelect } = props;

    const iconSize = 4;

    const itemTextColor = useColorModeValue("primary.900", "white");
    const iconColor = "primary.500";
    const selectedTextColor = "white";
    const hoverBackgroundColor = useColorModeValue("primary.50", "primary.700");
    const selectedBackgroundColor = useColorModeValue(
        "primary.500",
        "primary.500"
    );
    const icon = item.iconType ? (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={item.iconType}
            color={isSelected ? selectedTextColor : iconColor}
        />
    ) : null;

    const focusShadow = useToken("shadows", "outline");

    return (
        <Button
            bg="transparent"
            textColor={itemTextColor}
            px={3}
            leftIcon={icon}
            w="100%"
            borderRadius={6}
            justifyContent="start"
            fontWeight="normal"
            transition="none"
            onClick={onSelect}
            _hover={{
                bg: hoverBackgroundColor,
            }}
            _active={{
                textColor: selectedTextColor,
                bg: selectedBackgroundColor,
            }}
            _focus={{}}
            _focusVisible={{
                boxShadow: focusShadow,
            }}
            isActive={isSelected}
        >
            {item.title}
        </Button>
    );
};

export type SidebarNamespacesMenuProps = {
    isLoading?: boolean;
    namespaces: K8sObject[] | undefined;
    selection: AppNamespacesSelection;
    onChangeSelection: (
        selection: AppNamespacesSelection,
        requestNewWindow?: boolean
    ) => void;
};

export const SidebarNamespacesMenu: React.FC<SidebarNamespacesMenuProps> = (
    props
) => {
    const {
        isLoading = false,
        onChangeSelection,
        namespaces = [],
        selection,
    } = props;

    const opacity = useWindowFocusValue(1.0, 0.5);

    const onClickAll = useCallback(() => {
        onChangeSelection({
            ...selection,
            mode: "all",
        });
    }, [selection, onChangeSelection]);
    const onClickSelected = useCallback(() => {
        onChangeSelection({
            ...selection,
            mode: "selected",
        });
    }, [selection, onChangeSelection]);

    const itemTextColor = useColorModeValue("primary.900", "white");

    const namespacesToggleBorderColor = "primary.500";
    const namespacesToggleHoverColor = useColorModeValue(
        "primary.50",
        "primary.700"
    );

    const checkboxBorderColor = useColorModeValue("primary.300", "primary.700");

    const query = useAppSearch((s) => s.query);
    const filteredNamespaces = useMemo(
        () => namespaces.filter((ns) => searchMatch(query, ns.metadata.name)),
        [namespaces, query]
    );

    const namespaceNames = useMemo(
        () => namespaces.map((ns) => ns.metadata.name),
        [namespaces]
    );

    const updateNamespacesSelect = useMultiSelectUpdater(
        namespaceNames,
        selection.selected
    );
    const shiftKeyRef = useModifierKeyRef("Shift");

    const onChangeSelectedNamespaces = useCallback(
        (namespaces: string[]) => {
            onChangeSelection({
                ...selection,
                selected: updateNamespacesSelect(
                    namespaces,
                    shiftKeyRef.current
                ),
            });
        },
        [onChangeSelection, selection, updateNamespacesSelect]
    );

    const metaKeyRef = useModifierKeyRef("Meta");

    const onClickSingleNamespace = useMemo(
        () =>
            Object.fromEntries(
                namespaces.map((namespace) => [
                    namespace.metadata.name,
                    (e: MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onChangeSelection(
                            {
                                ...selection,
                                selected: [namespace.metadata.name],
                            },
                            metaKeyRef.current
                        );
                    },
                ])
            ),
        [metaKeyRef, namespaces, onChangeSelection, selection]
    );

    const focusShadow = useToken("shadows", "outline");

    const buildMenuItem = (namespace: K8sObject) => {
        const name = namespace.metadata.name;
        return (
            <HStack w="100%" spacing={0} key={name}>
                <Checkbox
                    color={itemTextColor}
                    px={4}
                    size="sm"
                    value={name}
                    py={1}
                    borderColor={checkboxBorderColor}
                    flexShrink="0"
                />
                <Box
                    fontSize="sm"
                    onClick={onClickSingleNamespace[name]}
                    flexGrow="1"
                    isTruncated
                    pe={4}
                >
                    {name}
                </Box>
            </HStack>
        );
    };

    return (
        <Fragment>
            <Heading
                textColor={"primary.500"}
                fontWeight="semibold"
                fontSize="xs"
                textTransform="uppercase"
                opacity={opacity}
                px={4}
                pt={4}
            >
                Namespaces
            </Heading>

            <Box px={4} flex="0 0 0" opacity={opacity}>
                <ButtonGroup variant="outline" size="xs" isAttached>
                    <Button
                        mr="-1px"
                        borderColor={namespacesToggleBorderColor}
                        textColor={itemTextColor}
                        isActive={selection.mode === "all"}
                        _active={{
                            bg: namespacesToggleBorderColor,
                            textColor: "white",
                        }}
                        _hover={{
                            bg: namespacesToggleHoverColor,
                        }}
                        _focus={{}}
                        _focusVisible={{
                            boxShadow: focusShadow,
                        }}
                        onClick={onClickAll}
                    >
                        All
                    </Button>
                    <Button
                        borderColor={namespacesToggleBorderColor}
                        textColor={itemTextColor}
                        isActive={selection.mode === "selected"}
                        isLoading={isLoading}
                        _active={{
                            bg: namespacesToggleBorderColor,
                            textColor: "white",
                        }}
                        _hover={{
                            bg: namespacesToggleHoverColor,
                        }}
                        _focus={{}}
                        _focusVisible={{
                            boxShadow: focusShadow,
                        }}
                        onClick={onClickSelected}
                    >
                        Selected
                    </Button>
                </ButtonGroup>
            </Box>
            <Box
                flex="1 0 0"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
                opacity={opacity}
            >
                <Collapse in={selection.mode === "selected"}>
                    <CheckboxGroup
                        colorScheme="primary"
                        value={selection.selected ?? []}
                        onChange={onChangeSelectedNamespaces}
                    >
                        <VStack alignItems="start" spacing={2} pt={1} pb={4}>
                            {filteredNamespaces.map(buildMenuItem)}
                        </VStack>
                    </CheckboxGroup>
                </Collapse>
            </Box>
        </Fragment>
    );
};
