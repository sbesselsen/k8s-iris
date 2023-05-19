import {
    Badge,
    Box,
    Button,
    HStack,
    Link,
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuList,
    Spinner,
    Table,
    TableCellProps,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
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
import { ChevronDownIcon, InfoOutlineIcon } from "@chakra-ui/icons";
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
import { useAppSearch } from "../../context/search";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useK8sVersionGetter, useLastKnownK8sVersion } from "../../k8s/version";
import { Selectable } from "../../component/main/Selectable";

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
    };

function useOpenContext(): (
    context: string,
    requestNewWindow?: boolean
) => void {
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const editorsStore = useAppEditorsStore();

    const showDialog = useDialog();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const [, , setAppCurrentContext] = usePersistentState("currentContext");

    return useCallback(
        async (context: string, requestNewWindow = false) => {
            function openInNewWindow() {
                setAppCurrentContext(context);

                createWindow({
                    route: {
                        ...emptyAppRoute,
                        context,
                    },
                });
            }

            function open() {
                setAppCurrentContext(context);

                setAppRoute(() => ({ ...emptyAppRoute, context }));
            }

            if (requestNewWindow) {
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
            getAppRoute,
            setAppRoute,
            setAppCurrentContext,
            showDialog,
        ]
    );
}

export const ContextSelectMenu = React.forwardRef<HTMLButtonElement, {}>(
    (_props, ref) => {
        const kubeContext = useOptionalK8sContext();
        const getAppRoute = useAppRouteGetter();
        const setAppRoute = useAppRouteSetter();

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

        const openContext = useOpenContext();

        const onSelectContext = useCallback(
            (context: string) => {
                openContext(context, metaKeyPressedRef.current);
                onClose();
            },
            [metaKeyPressedRef, openContext, onClose]
        );

        const onClickList = useCallback(() => {
            if (metaKeyPressedRef.current) {
                createWindow({
                    route: {
                        ...emptyAppRoute,
                        menuItem: "contexts",
                    },
                });
            } else {
                setAppRoute((route) => ({
                    ...route,
                    activeEditor: null,
                    menuItem: "contexts",
                }));
            }
            onClose();
        }, [
            createWindow,
            onClose,
            getAppRoute,
            metaKeyPressedRef,
            setAppRoute,
        ]);

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
                    {!searchValue && (
                        <MenuItem
                            onClick={onClickList}
                            fontSize="sm"
                            px={4}
                            icon={<InfoOutlineIcon />}
                        >
                            List all contexts
                        </MenuItem>
                    )}
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
        <MenuItem
            onClick={onClick}
            fontSize="sm"
            px={4}
            icon={
                <Box
                    w="11px"
                    h="11px"
                    borderRadius="sm"
                    bg={colorScheme + ".500"}
                ></Box>
            }
        >
            {option.label}
        </MenuItem>
    );
};

export const ContextsOverview: React.FC<{}> = () => {
    const [, contextsInfo] = useK8sContextsInfo();

    const contextOptions: ContextOption[] = useMemo(
        () =>
            contextsInfo?.map((context) => ({
                ...context,
                ...(context.cloudInfo ?? null),
                bestAccountId: context.cloudInfo?.accounts?.[0].accountId,
                bestAccountName: context.cloudInfo?.accounts?.[0].accountName,
                value: context.name,
                label: context.cloudInfo?.localClusterName ?? context.name,
            })) ?? [],
        [contextsInfo]
    );

    const { query } = useAppSearch();

    const filteredContextOptions = useMemo(
        () =>
            query
                ? contextOptions.filter((option) => filterOption(option, query))
                : contextOptions,
        [contextOptions, query]
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

    return (
        <ScrollBox flex="1 0 0" px={0}>
            <Table size="sm" mb="100px" sx={{ tableLayout: "fixed" }}>
                <Thead>
                    <Tr>
                        <Th w={4} px={0} borderBottom="none"></Th>
                        <Th w="11px" whiteSpace="nowrap"></Th>
                        <Th ps={0} whiteSpace="nowrap">
                            Context
                        </Th>
                        <Th ps={2} w="200px" whiteSpace="nowrap">
                            Group
                        </Th>
                        <Th w="200px" whiteSpace="nowrap">
                            Version
                        </Th>
                        <Th w={4} px={0} borderBottom="none"></Th>
                    </Tr>
                </Thead>
                {groupedContextOptions.map(({ label, options }, groupIndex) => (
                    <Tbody key={groupIndex}>
                        {options.map((option) => (
                            <ContextsOverviewRow
                                key={option.name}
                                groupLabel={label}
                                option={option}
                            />
                        ))}
                    </Tbody>
                ))}
            </Table>
        </ScrollBox>
    );
};

export const ContextsOverviewRow: React.FC<{
    option: ContextOption;
    groupLabel: string;
}> = (props) => {
    const { option, groupLabel } = props;
    const kubeContext = option.name;

    const { colorScheme } = k8sAccountIdColor(option.bestAccountId ?? null);

    let parts: string[] = ["", ""];
    if (option.localClusterName) {
        parts = option.name.split(option.localClusterName);
    }

    const metaKeyPressedRef = useModifierKeyRef("Meta");

    const mutedColor = useColorModeValue("gray.600", "gray.400");
    const brightColor = useColorModeValue(
        "rgba(56, 56, 56, 1)",
        "rgba(255, 255, 255, 0.92)"
    );

    const selectedBg = useColorModeValue(
        "systemAccent.100",
        "systemAccent.800"
    );

    const openContext = useOpenContext();
    const onClickLink = useCallback(() => {
        openContext(kubeContext, metaKeyPressedRef.current);
    }, [openContext, kubeContext, metaKeyPressedRef]);

    const getVersion = useK8sVersionGetter({ kubeContext });
    const [versionLoadError, setVersionLoadError] = useState<any | null>(null);

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);
    const onRightClick = useCallback(async () => {
        const result = await popup({
            menuTemplate: [
                { label: "Open", actionId: "open" },
                { label: "Copy", actionId: "copy" },
                { label: "Reload version", actionId: "reload-version" },
            ],
        });
        const actionId = result.actionId;
        if (!actionId) {
            return;
        }
        switch (actionId) {
            case "open":
                openContext(kubeContext, result.metaKey ?? false);
                break;
            case "copy":
                navigator.clipboard.writeText(kubeContext);
                break;
            case "reload-version":
                try {
                    await getVersion();
                    setVersionLoadError(null);
                } catch (e: any) {
                    setVersionLoadError(e?.message ? e.message : String(e));
                }
                break;
        }
    }, [getVersion, kubeContext, popup, setVersionLoadError]);

    const commonProps: TableCellProps = useMemo(
        () => ({
            verticalAlign: "baseline",
            borderBottom: "none",
        }),
        []
    );

    return (
        <Tr onAuxClick={onRightClick} sx={{ _hover: { bg: selectedBg } }}>
            <Td {...commonProps} w={4} px={0}></Td>
            <Td {...commonProps} px={2} verticalAlign="middle">
                <Box
                    w="11px"
                    h="11px"
                    borderRadius="sm"
                    bg={colorScheme + ".500"}
                    display="inline-block"
                    me={2}
                ></Box>
            </Td>
            <Td ps={0} {...commonProps}>
                <Link cursor="pointer" onClick={onClickLink} color={mutedColor}>
                    {parts.map((part, index) => {
                        if (index > 0) {
                            return (
                                <Text
                                    key={index}
                                    cursor="inherit"
                                    as="span"
                                    color={brightColor}
                                >
                                    {option.localClusterName ?? option.name}
                                </Text>
                            );
                        }
                        if (!part) {
                            return null;
                        }
                        return (
                            <Text key={index} cursor="inherit" as="span">
                                {part}
                            </Text>
                        );
                    })}
                </Link>
            </Td>
            <Td ps={2} {...commonProps}>
                {groupLabel}
            </Td>
            <Td {...commonProps}>
                <ContextsOverviewVersion
                    kubeContext={option.name}
                    error={versionLoadError}
                />
            </Td>
            <Td {...commonProps} w={4} px={0}></Td>
        </Tr>
    );
};

export const ContextsOverviewVersion: React.FC<{
    kubeContext: string;
    error?: any | null | undefined;
}> = (props) => {
    const { kubeContext, error } = props;

    const [isLoading, version] = useLastKnownK8sVersion({
        kubeContext,
    });

    if (isLoading) {
        return null;
    }

    if (error) {
        return (
            <Badge
                position="absolute"
                colorScheme="red"
                fontWeight="normal"
                title={String(error)}
            >
                error
            </Badge>
        );
    }

    if (!version) {
        return (
            <Badge position="absolute" colorScheme="gray" fontWeight="normal">
                unknown
            </Badge>
        );
    }

    return (
        <Selectable as="span" title={`Last seen: ${version.date}`}>
            {version.version}
        </Selectable>
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
