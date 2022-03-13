import {
    Box,
    Button,
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
import { useColorTheme } from "../../context/color-theme";
import { useK8sContext } from "../../context/k8s-context";
import { useIpcCall } from "../../hook/ipc";
import { useAppRouteActions } from "../../context/route";
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

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
    };

export const ContextSelectMenu = React.forwardRef<HTMLButtonElement, {}>(
    (_props, ref) => {
        const kubeContext = useK8sContext();
        const { selectContext } = useAppRouteActions();
        const { colorScheme } = useColorTheme();

        const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

        const metaKeyPressedRef = useModifierKeyRef("Meta");

        const [searchValue, setSearchValue] = useState("");

        const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();

        const onClose = useCallback(() => {
            setSearchValue("");
            onDisclosureClose();
        }, [onDisclosureClose, setSearchValue]);

        const onSelectContext = useCallback(
            (context: string) => {
                if (metaKeyPressedRef.current) {
                    createWindow({
                        route: {
                            ...emptyAppRoute,
                            context,
                        },
                    });
                } else {
                    selectContext(context);
                    onClose();
                }
            },
            [createWindow, onClose, selectContext]
        );

        const [isLoading, contextsInfo] = useK8sContextsInfo();
        const isLoadingWithDelay = useWithDelay(isLoading, 1000);

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

        const popupBackground = useColorModeValue("gray.50", "gray.800");
        const popupSearchBackground = useColorModeValue("gray.200", "black");
        const popupSearchPlaceholderColor = useColorModeValue(
            "gray.500",
            "gray.400"
        );
        const popupBorderColor = useColorModeValue("gray.200", "gray.700");

        const focusBoxShadow = useToken("shadows", "outline");

        return (
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
                    width="100%"
                    textAlign="start"
                    colorScheme={colorScheme}
                    size="sm"
                    boxShadow="0 1px 2px rgba(0, 0, 0, 0.1)"
                    _active={{
                        bg: "",
                    }}
                    _focus={{}}
                    _focusVisible={{
                        boxShadow: focusBoxShadow,
                    }}
                    ref={ref}
                >
                    <Box isTruncated>
                        {isLoadingWithDelay && <Spinner />}
                        {!isLoading && (
                            <Fragment>
                                {currentContextInfo?.localClusterName ??
                                    kubeContext}
                            </Fragment>
                        )}
                    </Box>
                </MenuButton>
                <MenuList
                    maxHeight="calc(100vh - 100px)"
                    overflowY="scroll"
                    boxShadow="xl"
                    borderColor={popupBorderColor}
                    bg={popupBackground}
                    zIndex={20}
                >
                    <MenuInput
                        placeholder="Search"
                        value={searchValue}
                        onChange={onChangeSearchInput}
                        onPressEnter={onPressSearchEnter}
                        size="sm"
                        borderRadius="md"
                        bg={popupSearchBackground}
                        border="0"
                        mb={2}
                        _placeholder={{
                            textColor: popupSearchPlaceholderColor,
                        }}
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
