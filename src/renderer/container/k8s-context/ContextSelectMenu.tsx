import {
    Box,
    Button,
    HStack,
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuList,
    Spinner,
    useColorModeValue,
    useDisclosure,
    useToken,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    Fragment,
    useCallback,
    useMemo,
    useState,
} from "react";
import { MenuInput } from "../../component/MenuInput";
import { useOptionalK8sContext } from "../../context/k8s-context";
import { useIpcCall } from "../../hook/ipc";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useModifierKeyRef } from "../../hook/keyboard";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { K8sContext } from "../../../common/k8s/client";
import { CloudK8sContextInfo } from "../../../common/cloud/k8s";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { groupByKeys } from "../../../common/util/group";
import { k8sSmartCompare } from "../../../common/util/sort";
import { searchMatch } from "../../../common/util/search";
import { useWithDelay } from "../../hook/async";
import { k8sAccountIdColor } from "../../util/k8s-context-color";
import { emptyAppRoute } from "../../../common/route/app-route";
import { useAppEditorsStore } from "../../context/editors";
import { useDialog } from "../../hook/dialog";
import { useWindowFocus } from "../../hook/window-focus";
import { usePersistentState } from "../../hook/persistent-state";

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
    };

export const ContextSelectMenu = React.forwardRef<HTMLButtonElement, {}>(
    (_props, ref) => {
        const kubeContext = useOptionalK8sContext();
        const getAppRoute = useAppRouteGetter();
        const setAppRoute = useAppRouteSetter();
        const editorsStore = useAppEditorsStore();

        const showDialog = useDialog();

        const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

        const metaKeyPressedRef = useModifierKeyRef("Meta");

        const [searchValue, setSearchValue] = useState("");

        const {
            isOpen,
            onOpen: onDisclosureOpen,
            onClose: onDisclosureClose,
        } = useDisclosure();

        const [isLoading, contextsInfo] = useK8sContextsInfo();
        const isLoadingWithDelay = useWithDelay(isLoading, 1000);

        const onOpen = useCallback(() => {
            onDisclosureOpen();
        }, [onDisclosureOpen]);

        const onClose = useCallback(() => {
            setSearchValue("");
            onDisclosureClose();
        }, [onDisclosureClose, setSearchValue]);

        const [, , setAppCurrentContext] = usePersistentState("currentContext");

        const onSelectContext = useCallback(
            async (context: string) => {
                setAppCurrentContext(context);

                function openInNewWindow() {
                    createWindow({
                        route: {
                            ...emptyAppRoute,
                            context,
                        },
                    });
                    onDisclosureClose();
                }

                function open() {
                    setAppRoute(() => ({ ...emptyAppRoute, context }));
                    onClose();
                }

                if (metaKeyPressedRef.current) {
                    openInNewWindow();
                    return;
                }
                if (context === getAppRoute().context) {
                    // Do not switch at all if the context remains the same.
                    return;
                }
                const numEditors = editorsStore.get().length;
                if (numEditors === 0) {
                    open();
                    return;
                }
                const result = await showDialog({
                    title: "Are you sure?",
                    type: "question",
                    message: `You have ${numEditors} editor${
                        numEditors > 1 ? "s" : ""
                    } open.`,
                    detail: `Switching context will close all open editors and you will lose your changes.`,
                    buttons: [
                        "Open in New Window",
                        "Close Editors and Switch",
                        "Cancel",
                    ],
                    defaultId: 0,
                });
                switch (result.response) {
                    case 0:
                        openInNewWindow();
                        break;
                    case 1:
                        open();
                        break;
                }
            },
            [
                createWindow,
                editorsStore,
                onClose,
                onDisclosureClose,
                getAppRoute,
                setAppRoute,
                setAppCurrentContext,
                showDialog,
            ]
        );

        const contextOptions: ContextOption[] = useMemo(
            () =>
                contextsInfo?.map((context) => ({
                    ...context,
                    ...(context.cloudInfo ?? null),
                    bestAccountId: context.cloudInfo?.accounts?.[0].accountId,
                    bestAccountName:
                        context.cloudInfo?.accounts?.[0].accountName,
                    value: context.name,
                    label: context.cloudInfo?.localClusterName ?? context.name,
                })) ?? [],
            [contextsInfo]
        );

        const currentContextInfo = useMemo(
            () =>
                contextOptions?.find((option) => option.value === kubeContext),
            [contextOptions, kubeContext]
        );

        const filteredContextOptions = useMemo(
            () =>
                contextOptions.filter((option) =>
                    filterOption(option, searchValue)
                ),
            [contextOptions, searchValue]
        );

        const groupedContextOptions = useMemo(
            () =>
                groupByKeys(
                    filteredContextOptions,
                    [
                        "cloudProvider",
                        "cloudService",
                        "bestAccountName",
                        "bestAccountId",
                        "region",
                    ],
                    (_, a, b) => k8sSmartCompare(a, b)
                ).map(([group, contexts]) => ({
                    label: groupLabel(group),
                    options: contexts.sort((a, b) =>
                        k8sSmartCompare(
                            a.localClusterName ?? a.name,
                            b.localClusterName ?? b.name
                        )
                    ),
                })),
            [filteredContextOptions]
        );

        const onChangeSearchInput = useCallback(
            (e: ChangeEvent<HTMLInputElement>) => {
                setSearchValue(e.target.value);
            },
            [setSearchValue]
        );

        const onPressSearchEnter = useCallback(() => {
            if (filteredContextOptions.length === 1) {
                onSelectContext(filteredContextOptions[0].name);
            }
        }, [filteredContextOptions, onSelectContext]);

        const popupSearchPlaceholderColor = useColorModeValue(
            "gray.500",
            "gray.400"
        );

        const focusBoxShadow = useToken("shadows", "outline");
        const isWindowFocused = useWindowFocus();

        return (
            <Menu
                isOpen={isOpen && isWindowFocused}
                onOpen={onOpen}
                onClose={onClose}
                matchWidth={true}
                orientation="horizontal"
                gutter={1}
            >
                <MenuButton
                    as={Button}
                    rightIcon={<ChevronDownIcon />}
                    width="100%"
                    textAlign="start"
                    colorScheme="contextClue"
                    bg="contextClue.500"
                    textColor="white"
                    size="sm"
                    flex="1 0 0"
                    _active={{
                        bg: "",
                    }}
                    _focus={{}}
                    _focusVisible={{
                        boxShadow: focusBoxShadow,
                    }}
                    ref={ref}
                >
                    <HStack h="100%" alignItems="center" isTruncated>
                        {isLoadingWithDelay && <Spinner />}
                        {!isLoading && (
                            <Fragment>
                                {currentContextInfo?.localClusterName ??
                                    kubeContext ??
                                    "(no context)"}
                            </Fragment>
                        )}
                    </HStack>
                </MenuButton>
                <MenuList
                    maxHeight="calc(100vh - 100px)"
                    overflowY="scroll"
                    boxShadow="xl"
                    zIndex={40}
                >
                    <MenuInput
                        placeholder="Search"
                        value={searchValue}
                        onChange={onChangeSearchInput}
                        onPressEnter={onPressSearchEnter}
                        size="sm"
                        borderRadius="md"
                        bg="rgba(0, 0, 0, 0.1)"
                        _placeholder={{
                            textColor: popupSearchPlaceholderColor,
                        }}
                        border="0"
                        mb={2}
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                    />
                    {isLoadingWithDelay && (
                        <Box p={4}>
                            <Spinner />
                        </Box>
                    )}
                    {groupedContextOptions.map((group, index) => (
                        <ContextMenuGroup
                            group={group}
                            key={index}
                            onSelectContext={onSelectContext}
                        />
                    ))}
                </MenuList>
            </Menu>
        );
    }
);

type ContextMenuGroupProps = {
    group: {
        label: string;
        options: ContextOption[];
    };
    onSelectContext: (context: string) => void;
};

const ContextMenuGroup: React.FC<ContextMenuGroupProps> = (props) => {
    const { group, onSelectContext } = props;
    return (
        <Fragment>
            <MenuGroup
                title={group.label}
                pt={0}
                mb={0}
                color="gray.500"
                fontWeight="semibold"
                fontSize="xs"
                textTransform="uppercase"
            >
                {group.options.map((contextOption) => (
                    <ContextMenuItem
                        key={contextOption.name}
                        option={contextOption}
                        onSelectContext={onSelectContext}
                    />
                ))}
            </MenuGroup>
        </Fragment>
    );
};

type ContextMenuItemProps = {
    option: ContextOption;
    onSelectContext: (context: string) => void;
};

const ContextMenuItem: React.FC<ContextMenuItemProps> = (props) => {
    const { onSelectContext, option } = props;
    const onClick = useCallback(() => {
        onSelectContext(option.name);
    }, [onSelectContext, option]);

    const { colorScheme } = k8sAccountIdColor(option.bestAccountId ?? null);

    return (
        <MenuItem onClick={onClick} fontSize="sm" px={4}>
            <Box
                w={2}
                h={2}
                borderRadius="sm"
                bg={colorScheme + ".500"}
                me={2}
            ></Box>{" "}
            {option.label}
        </MenuItem>
    );
};

function groupLabel(group: Partial<ContextOption>): string {
    return [
        group.cloudProvider,
        group.cloudService,
        group.bestAccountName ?? group.bestAccountId,
        group.region,
    ]
        .filter((x) => x)
        .join(" • ");
}

function filterOption(option: ContextOption, input: string): boolean {
    return searchMatch(
        input,
        [
            option.name,
            option.cloudProvider,
            option.cloudService,
            option.region,
            option.bestAccountId,
            option.bestAccountName,
            option.localClusterName,
        ]
            .filter((x) => x)
            .join(" ")
    );
}
