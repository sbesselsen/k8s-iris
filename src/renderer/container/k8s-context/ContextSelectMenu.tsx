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

    return (
        <Menu isOpen={isOpen} onOpen={onOpen} onClose={onClose}>
            <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                variant="ghost"
            >
                {isLoadingWithDelay && <Spinner />}
                {!isLoading &&
                    (currentContextInfo?.localClusterName ?? kubeContext)}
            </MenuButton>
            <MenuList
                maxHeight="300px"
                overflowY="scroll"
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
    return <MenuItem onClick={onClick}>{option.label}</MenuItem>;
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
