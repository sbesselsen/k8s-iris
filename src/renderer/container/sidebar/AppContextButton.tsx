import { Box, Button, useToken } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { useOptionalK8sContext } from "../../context/k8s-context";
import { K8sContext } from "../../../common/k8s/client";
import { CloudK8sContextInfo } from "../../../common/cloud/k8s";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { groupByKeys } from "../../../common/util/group";
import { k8sSmartCompare } from "../../../common/util/sort";
import {
    AppCommand,
    useAppCommandBar,
    useAppCommands,
} from "../app/AppCommandBar";
import { useOpenContext } from "../../hook/context-opener";
import { ContextIcon } from "../../component/k8s/ContextIcon";

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
    };

export const AppContextButton: React.FC<{}> = () => {
    const kubeContext = useOptionalK8sContext();

    const [, contextsInfo] = useK8sContextsInfo();

    const openContext = useOpenContext();

    const commandBar = useAppCommandBar();

    const onClickContext = useCallback(() => {
        commandBar.toggle({
            isVisible: true,
            parentCommandId: "switch-context",
            search: "",
        });
    }, [commandBar]);

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

    const groupedContextOptions = useMemo(
        () =>
            groupByKeys(
                contextOptions,
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
        [contextOptions]
    );

    const commands: AppCommand[] = useMemo(() => {
        return [
            {
                id: "switch-context",
                text: "Switch context to",
                perform() {},
            },
            ...groupedContextOptions.flatMap(({ label, options }) =>
                options.map((option) => ({
                    id: `switch-context:${option.name}`,
                    text: option.label,
                    detailText: label || undefined,
                    parentId: "switch-context",
                    icon: <ContextIcon colorId={option.bestAccountId} />,
                    perform() {
                        openContext(option.name);
                    },
                }))
            ),
        ];
    }, [groupedContextOptions, openContext]);
    useAppCommands(commands);

    const focusBoxShadow = useToken("shadows", "outline");

    return (
        <Button
            variant="sidebarGhost"
            leftIcon={
                currentContextInfo && (
                    <Box ps="3px" pe="2px">
                        <ContextIcon
                            colorId={currentContextInfo.bestAccountId}
                        />
                    </Box>
                )
            }
            _focus={{}}
            _focusVisible={{
                boxShadow: focusBoxShadow,
            }}
            onClick={onClickContext}
        >
            {currentContextInfo
                ? currentContextInfo.localClusterName ?? currentContextInfo.name
                : ""}
        </Button>
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
