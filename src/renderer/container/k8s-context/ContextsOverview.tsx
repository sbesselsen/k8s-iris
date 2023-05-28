import {
    Badge,
    Link,
    Table,
    TableCellProps,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useColorModeValue,
} from "@chakra-ui/react";
import React, { useCallback, useMemo, useState } from "react";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { K8sContext } from "../../../common/k8s/client";
import { CloudK8sContextInfo } from "../../../common/cloud/k8s";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { groupByKeys } from "../../../common/util/group";
import { k8sSmartCompare } from "../../../common/util/sort";
import { searchMatch } from "../../../common/util/search";
import { useAppSearch } from "../../context/search";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useK8sVersionGetter, useLastKnownK8sVersion } from "../../k8s/version";
import { Selectable } from "../../component/main/Selectable";
import { useOpenContext } from "../../hook/context-opener";
import { ContextIcon } from "../../component/k8s/ContextIcon";

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
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
                <ContextIcon
                    colorId={option.bestAccountId}
                    display="inline-block"
                    me={2}
                />
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
                colorScheme="red"
                lineHeight="initial"
                fontWeight="normal"
                title={String(error)}
            >
                error
            </Badge>
        );
    }

    if (!version) {
        return (
            <Badge colorScheme="gray" lineHeight="initial" fontWeight="normal">
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
