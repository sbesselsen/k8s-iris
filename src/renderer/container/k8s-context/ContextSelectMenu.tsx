import {
    Box,
    Button,
    Menu,
    MenuButton,
    MenuDivider,
    MenuGroup,
    MenuItem,
    MenuList,
    Spinner,
    useDisclosure,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    Fragment,
    useCallback,
    useMemo,
    useState,
} from "react";
import { MenuInput } from "../../component/MenuInput";
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
import { menuGroupStylesHack } from "../../theme";
import { searchMatch } from "../../../common/util/search";
import { useWithDelay } from "../../hook/async";
import { useK8sContextColorScheme } from "../../hook/k8s-context-color-scheme";

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
    };

export const ContextSelectMenu: React.FC = () => {
    const kubeContext = useK8sContext();
    const { selectContext } = useAppRouteActions();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const metaKeyPressedRef = useModifierKeyRef("Meta");

    const [searchValue, setSearchValue] = useState("");

    const { isOpen, onOpen, onClose } = useDisclosure();

    const onSelectContext = useCallback(
        (context: string) => {
            if (metaKeyPressedRef.current) {
                createWindow({
                    context,
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
                bestAccountName: context.cloudInfo?.accounts?.[0].accountName,
                value: context.name,
                label: context.cloudInfo?.localClusterName ?? context.name,
            })) ?? [],
        [contextsInfo]
    );

    const currentContextInfo = useMemo(
        () => contextOptions?.find((option) => option.value === kubeContext),
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

    const buttonColors = useK8sContextColorScheme(kubeContext);

    return (
        <Menu
            isOpen={isOpen}
            onOpen={onOpen}
            onClose={onClose}
            gutter={0}
            matchWidth={true}
        >
            <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                bg={buttonColors.fill}
                textColor={buttonColors.background}
                _hover={{ bg: buttonColors.fill }}
                _active={{ bg: buttonColors.fill }}
                width="100%"
                textAlign="start"
            >
                {isLoadingWithDelay && <Spinner />}
                {!isLoading && (
                    <Fragment>
                        {currentContextInfo?.localClusterName ?? kubeContext}
                    </Fragment>
                )}
            </MenuButton>
            <MenuList
                maxHeight="calc(100vh - 100px)"
                overflowY="scroll"
                boxShadow="xl"
                sx={menuGroupStylesHack}
            >
                <MenuInput
                    placeholder="Search"
                    value={searchValue}
                    onChange={onChangeSearchInput}
                    onPressEnter={onPressSearchEnter}
                />
                <MenuDivider />
                {isLoadingWithDelay && (
                    <Box p={4}>
                        <Spinner />
                    </Box>
                )}
                {groupedContextOptions.map((group, index) => (
                    <Fragment>
                        {index > 0 && <MenuDivider />}
                        <ContextMenuGroup
                            group={group}
                            key={index}
                            onSelectContext={onSelectContext}
                        />
                    </Fragment>
                ))}
            </MenuList>
        </Menu>
    );
};

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
        <MenuGroup title={group.label}>
            {group.options.map((contextOption) => (
                <ContextMenuItem
                    key={contextOption.name}
                    option={contextOption}
                    onSelectContext={onSelectContext}
                />
            ))}
        </MenuGroup>
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
    const colors = useK8sContextColorScheme(option.name);
    return (
        <MenuItem onClick={onClick}>
            <Box
                w="1em"
                h="1em"
                borderRadius="full"
                borderWidth="2px"
                borderColor={colors.border}
                bg={colors.background}
                display="inline-block"
                marginEnd={2}
            ></Box>
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
