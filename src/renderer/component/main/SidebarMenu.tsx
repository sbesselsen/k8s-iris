import { AddIcon, CloseIcon } from "@chakra-ui/icons";
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
    ButtonProps,
} from "@chakra-ui/react";
import React, {
    ElementType,
    KeyboardEvent,
    MouseEvent,
    ReactNode,
    useCallback,
    useMemo,
} from "react";
import { FiTerminal } from "react-icons/fi";
import { RiTextWrap } from "react-icons/ri";
import { K8sObject } from "../../../common/k8s/client";
import {
    AppEditor,
    AppNamespacesSelection,
} from "../../../common/route/app-route";
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
        <VStack pt={2} px={2} spacing={0} opacity={opacity}>
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
        const isDeleting = !!(namespace.metadata as any).deletionTimestamp;

        return (
            <HStack
                w="100%"
                spacing={0}
                key={name}
                opacity={isDeleting ? 0.5 : 1}
            >
                <Checkbox
                    color={itemTextColor}
                    px={4}
                    size="sm"
                    value={name}
                    py={1}
                    borderColor={checkboxBorderColor}
                    flexShrink={0}
                />
                <Box
                    fontSize="sm"
                    onClick={onClickSingleNamespace[name]}
                    flexGrow={1}
                    textColor={itemTextColor}
                    isTruncated
                    pe={4}
                >
                    {name}
                </Box>
            </HStack>
        );
    };

    return (
        <VStack flex="1 0 0" alignItems="stretch">
            <Heading
                textColor={"primary.500"}
                fontWeight="semibold"
                fontSize="xs"
                textTransform="uppercase"
                opacity={opacity}
                px={4}
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
        </VStack>
    );
};

export type SidebarEditorsMenuItem = AppEditor;

export type SidebarEditorsMenuProps = {
    items: SidebarEditorsMenuItem[];
    selection?: string | undefined;
    onChangeSelection?: (selection: string, requestNewWindow?: boolean) => void;
    onCloseEditor?: (id: string) => void;
    onPressCreate?: () => void;
};

export const SidebarEditorsMenu: React.FC<SidebarEditorsMenuProps> = (
    props
) => {
    const {
        items,
        selection,
        onChangeSelection,
        onCloseEditor,
        onPressCreate,
    } = props;

    const opacity = useWindowFocusValue(1.0, 0.5);

    const metaKeyRef = useModifierKeyRef("Meta");
    const onSelectCallbacks = useMemo(
        () =>
            items.map((item) => () => {
                onChangeSelection?.(item.id, metaKeyRef.current);
            }),
        [items, metaKeyRef, onChangeSelection]
    );
    const onCloseEditorCallbacks = useMemo(
        () =>
            items.map((item) => () => {
                onCloseEditor?.(item.id);
            }),
        [items, onCloseEditor]
    );

    return (
        <VStack
            flex="0 0 auto"
            spacing={0}
            alignItems="stretch"
            p={0}
            opacity={opacity}
        >
            <Heading
                textColor={"primary.500"}
                fontWeight="semibold"
                fontSize="xs"
                textTransform="uppercase"
                px={4}
            >
                Resources
            </Heading>

            <VStack
                flex="0 0 auto"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
                maxHeight="210px"
                spacing={0}
                px={2}
                py={1}
            >
                {items.map((item, index) => (
                    <SidebarEditorsMenuButton
                        key={item.id}
                        isSelected={selection === item.id}
                        onSelect={onSelectCallbacks[index]}
                        onClose={onCloseEditorCallbacks[index]}
                        item={item}
                    />
                ))}
            </VStack>
            <Box px={2}>
                <SidebarEditorsCustomMenuButton
                    onClick={onPressCreate}
                    leftIcon={<AddIcon w={2} h={2} />}
                >
                    Create new
                </SidebarEditorsCustomMenuButton>
            </Box>
        </VStack>
    );
};

type SidebarEditorsMenuButtonProps = {
    item: SidebarEditorsMenuItem;
    isSelected?: boolean;
    onClose?: () => void;
    onSelect?: () => void;
};

const SidebarEditorsMenuButton: React.FC<SidebarEditorsMenuButtonProps> = (
    props
) => {
    const { item, isSelected = false, onClose, onSelect } = props;

    const iconSize = 2;
    const iconColor = "primary.500";
    const selectedTextColor = "white";

    const onClickCloseCallback = useCallback(
        (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onClose?.();
        },
        [onClose]
    );

    const icon = (
        <Box p={2} onClick={onClickCloseCallback} lineHeight={0}>
            <CloseIcon
                verticalAlign="middle"
                w={iconSize}
                h={iconSize}
                color={isSelected ? selectedTextColor : iconColor}
            />
        </Box>
    );

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                onClose?.();
            }
        },
        [onClose]
    );

    const onMouseDown = useCallback(
        (e: MouseEvent) => {
            if (e.button === 1) {
                // Middle button click.
                onClose?.();
            }
        },
        [onClose]
    );

    const leftIcon = useMemo(() => {
        if (item.type === "pod-shell") {
            return <Icon as={FiTerminal} />;
        }
        if (item.type === "pod-logs") {
            return <Icon as={RiTextWrap} />;
        }
        return null;
    }, [item]);

    return (
        <SidebarEditorsCustomMenuButton
            leftIcon={leftIcon}
            rightIcon={icon}
            onClick={onSelect}
            onKeyDown={onKeyDown}
            onMouseDown={onMouseDown}
            isActive={isSelected}
        >
            {item.name}
        </SidebarEditorsCustomMenuButton>
    );
};

const SidebarEditorsCustomMenuButton: React.FC<ButtonProps> = (props) => {
    const { children, ...buttonProps } = props;

    const itemTextColor = useColorModeValue("primary.900", "white");
    const selectedTextColor = "white";
    const hoverBackgroundColor = useColorModeValue("primary.50", "primary.700");
    const selectedBackgroundColor = useColorModeValue(
        "primary.500",
        "primary.500"
    );

    const focusShadow = useToken("shadows", "outline");

    return (
        <Button
            flex="0 0 auto"
            bg="transparent"
            textColor={itemTextColor}
            px={2}
            pe={1}
            py={0}
            w="100%"
            h={8}
            fontSize="sm"
            borderRadius={6}
            justifyContent="start"
            fontWeight="normal"
            transition="none"
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
            {...buttonProps}
        >
            <Box flex="1 0 0" textAlign="left" isTruncated>
                {children}
            </Box>
        </Button>
    );
};
