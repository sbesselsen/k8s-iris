import { AddIcon, CloseIcon, SettingsIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    Checkbox,
    CheckboxGroup,
    Heading,
    Icon,
    useColorModeValue,
    HStack,
    VStack,
    useToken,
    ButtonProps,
    IconButton,
    FormLabel,
} from "@chakra-ui/react";
import React, {
    ChangeEventHandler,
    ElementType,
    KeyboardEvent,
    MouseEvent,
    MouseEventHandler,
    ReactNode,
    useCallback,
    useMemo,
} from "react";
import { FiTerminal } from "react-icons/fi";
import { RiTextWrap } from "react-icons/ri";
import { ContextMenuResult } from "../../../common/contextmenu";
import { K8sObject } from "../../../common/k8s/client";
import {
    AppEditor,
    AppNamespacesSelection,
} from "../../../common/route/app-route";
import { searchMatch } from "../../../common/util/search";
import { ResourceContextMenu } from "../../container/resources/ResourceContextMenu";
import { useAppSearch } from "../../context/search";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useMultiSelectUpdater } from "../../hook/multi-select";
import { ContextMenuButton, MenuItem } from "./ContextMenuButton";

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
        <VStack spacing={0} alignItems="stretch">
            {items.map((item) => (
                <SidebarMenuButton
                    key={item.id}
                    item={item}
                    onSelect={onClickMenuItems[item.id]}
                    isSelected={!!item.id && item.id === selection}
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
    const icon = item.iconType ? (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={item.iconType}
        />
    ) : undefined;

    const focusShadow = useToken("shadows", "outline");

    return (
        <Button
            variant="sidebarGhost"
            leftIcon={icon}
            onClick={onSelect}
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
    onClickAddNamespace: (options: { requestNewWindow: boolean }) => void;
    onChangeSelection: (
        selection: AppNamespacesSelection,
        options: { requestNewWindow: boolean; requestBrowse: boolean }
    ) => void;
};

export const SidebarNamespacesMenu: React.FC<SidebarNamespacesMenuProps> = (
    props
) => {
    const {
        onChangeSelection,
        onClickAddNamespace,
        namespaces = [],
        selection,
    } = props;

    const metaKeyRef = useModifierKeyRef("Meta");

    const onChangeSelectAll: ChangeEventHandler<HTMLInputElement> = useCallback(
        (e) => {
            const checked = e.target.checked;
            onChangeSelection(
                {
                    ...selection,
                    mode: checked ? "all" : "selected",
                },
                {
                    requestNewWindow: metaKeyRef.current,
                    requestBrowse: false,
                }
            );
        },
        [metaKeyRef, onChangeSelection, selection]
    );

    const onClickSelectAll: MouseEventHandler = useCallback(
        (e) => {
            e.stopPropagation();
            e.preventDefault();
            onChangeSelection(
                {
                    ...selection,
                    mode: "all",
                },
                {
                    requestNewWindow: metaKeyRef.current,
                    requestBrowse: true,
                }
            );
        },
        [metaKeyRef, onChangeSelection, selection]
    );

    const itemTextColor = useColorModeValue("gray.700", "white");

    const checkboxBorderColor = useColorModeValue("gray.400", "gray.200");

    const headingColor = useColorModeValue("gray.600", "gray.200");

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
        selection.mode === "all" ? namespaceNames : selection.selected
    );
    const shiftKeyRef = useModifierKeyRef("Shift");

    const onChangeSelectedNamespaces = useCallback(
        (namespaces: string[]) => {
            onChangeSelection(
                {
                    ...selection,
                    mode: "selected",
                    selected: updateNamespacesSelect(
                        namespaces,
                        shiftKeyRef.current
                    ),
                },
                {
                    requestNewWindow: metaKeyRef.current,
                    requestBrowse: false,
                }
            );
        },
        [metaKeyRef, onChangeSelection, selection, updateNamespacesSelect]
    );

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
                                mode: "selected",
                                selected: [namespace.metadata.name],
                            },
                            {
                                requestNewWindow: metaKeyRef.current,
                                requestBrowse: true,
                            }
                        );
                    },
                ])
            ),
        [metaKeyRef, namespaces, onChangeSelection, selection]
    );

    const selectedNamespaces = useMemo(
        () => (selection.mode === "all" ? namespaceNames : selection.selected),
        [namespaceNames, selection]
    );

    const hoverBg = useColorModeValue("blackAlpha.50", "whiteAlpha.200");

    const buildMenuItem = (namespace: K8sObject) => {
        const name = namespace.metadata.name;
        const isDeleting = !!(namespace.metadata as any).deletionTimestamp;

        return (
            <HStack
                w="100%"
                spacing={0}
                key={name}
                opacity={isDeleting ? 0.5 : 1}
                py={1}
                borderRadius="6px"
                _hover={{
                    bg: hoverBg,
                }}
            >
                <Checkbox
                    color={itemTextColor}
                    ps={2}
                    pe={4}
                    size="sm"
                    value={name}
                    py={1}
                    borderColor={checkboxBorderColor}
                    flexShrink={0}
                />
                <ResourceContextMenu object={namespace}>
                    <Box
                        fontSize="sm"
                        onClick={onClickSingleNamespace[name]}
                        flexGrow={1}
                        textColor={itemTextColor}
                        isTruncated
                        pe={2}
                    >
                        {name}
                    </Box>
                </ResourceContextMenu>
            </HStack>
        );
    };

    const onNamespacesMenuAction = useCallback(
        ({ actionId, metaKey }: { actionId: string } & ContextMenuResult) => {
            if (actionId === "new") {
                onClickAddNamespace({
                    requestNewWindow: metaKey ?? false,
                });
            }
        },
        [onClickAddNamespace]
    );

    return (
        <VStack flex="1 0 0" alignItems="stretch" spacing={0}>
            <HStack ps={2} alignItems="center">
                <Heading
                    textColor={headingColor}
                    fontWeight="semibold"
                    fontSize="xs"
                    textTransform="uppercase"
                >
                    Namespaces
                </Heading>
                <Box flex="1 0 0"></Box>

                <ContextMenuButton
                    as={IconButton}
                    icon={<SettingsIcon />}
                    size="xs"
                    aria-label="Namespaces Actions"
                    variant="ghost"
                    colorScheme="gray"
                    onMenuAction={onNamespacesMenuAction}
                    _focus={{ boxShadow: "none" }}
                    _focusVisible={{ boxShadow: "outline" }}
                >
                    <MenuItem actionId="new" label="New..." />
                </ContextMenuButton>
            </HStack>

            <FormLabel>
                <HStack
                    w="100%"
                    spacing={0}
                    py={1}
                    borderRadius="6px"
                    fontWeight="medium"
                    _hover={{
                        bg: hoverBg,
                    }}
                >
                    <Checkbox
                        color={itemTextColor}
                        ps={2}
                        pe={4}
                        size="sm"
                        isChecked={selection.mode === "all"}
                        py={1}
                        borderColor={checkboxBorderColor}
                        onChange={onChangeSelectAll}
                        flexShrink={0}
                    />
                    <Box
                        fontSize="sm"
                        flexGrow={1}
                        textColor={itemTextColor}
                        onClick={onClickSelectAll}
                        isTruncated
                        pe={2}
                    >
                        All
                    </Box>
                </HStack>
            </FormLabel>

            <Box
                flex="1 0 0"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
            >
                <CheckboxGroup
                    colorScheme={selection.mode == "all" ? "gray" : "primary"}
                    value={selectedNamespaces}
                    onChange={onChangeSelectedNamespaces}
                >
                    <VStack alignItems="start" spacing={0} pt={1} pb={4}>
                        {filteredNamespaces.map(buildMenuItem)}
                    </VStack>
                </CheckboxGroup>
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
    onPressCreateShell?: () => void;
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
        onPressCreateShell,
    } = props;

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

    const headingColor = useColorModeValue("gray.600", "gray.200");

    return (
        <VStack flex="0 0 auto" spacing={0} alignItems="stretch" p={0}>
            <Heading
                textColor={headingColor}
                fontWeight="semibold"
                fontSize="xs"
                textTransform="uppercase"
                px={2}
            >
                Resources
            </Heading>

            <VStack
                flex="0 0 auto"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
                maxHeight="210px"
                spacing={0}
                py={1}
                alignItems="stretch"
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
            <VStack spacing={0} alignItems="stretch">
                <SidebarEditorsCustomMenuButton
                    onClick={onPressCreate}
                    leftIcon={<AddIcon w={2} h={2} />}
                >
                    New resource
                </SidebarEditorsCustomMenuButton>
                <SidebarEditorsCustomMenuButton
                    onClick={onPressCreateShell}
                    leftIcon={
                        <Icon
                            as={FiTerminal}
                            transform="scale(1.5)"
                            w={2}
                            h={2}
                        />
                    }
                >
                    New shell
                </SidebarEditorsCustomMenuButton>
            </VStack>
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

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);
    const onContextMenu: MouseEventHandler = useCallback(() => {
        if (!onClose) {
            return;
        }
        popup({
            menuTemplate: [{ label: "Close", actionId: "close" }],
        }).then(({ actionId }) => {
            if (actionId === "close") {
                onClose();
            }
        });
    }, [onClose, popup]);

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
            <CloseIcon verticalAlign="middle" w={iconSize} h={iconSize} />
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
        if (item.type === "local-shell") {
            return <Icon as={FiTerminal} />;
        }
        if (item.type === "pod-logs") {
            return <Icon as={RiTextWrap} />;
        }
    }, [item]);

    return (
        <SidebarEditorsCustomMenuButton
            leftIcon={leftIcon}
            rightIcon={icon}
            onClick={onSelect}
            onKeyDown={onKeyDown}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
            isActive={isSelected}
        >
            {item.name}
        </SidebarEditorsCustomMenuButton>
    );
};

const SidebarEditorsCustomMenuButton: React.FC<ButtonProps> = (props) => {
    const { children, ...buttonProps } = props;

    const focusShadow = useToken("shadows", "outline");

    return (
        <Button
            variant="sidebarGhost"
            flex="0 0 auto"
            px={2}
            pe={1}
            py={0}
            h={8}
            fontSize="sm"
            borderRadius={6}
            justifyContent="start"
            fontWeight="normal"
            transition="none"
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
