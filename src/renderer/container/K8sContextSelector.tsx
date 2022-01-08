import { Box, ChakraComponent, Heading } from "@chakra-ui/react";
import { Select } from "chakra-react-select";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { groupByKeys } from "../../common/util/group";
import { searchMatch } from "../../common/util/search";
import { k8sSmartCompare } from "../../common/util/sort";
import { useK8sContext, useK8sContextStore } from "../context/k8s-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";
import { useModifierKeyRef } from "../hook/keyboard";

type ContextOption = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
        value: string;
        label: string;
    };

export const K8sContextSelector: ChakraComponent<"div", {}> = (props) => {
    const boxProps = {
        width: "400px",
        ...props,
    };

    const kubeContext = useK8sContext();
    const kubeContextStore = useK8sContextStore();

    const ipc = useIpc();

    const [_loadingContexts, contexts] = useAsync(
        () => ipc.k8s.listContexts(),
        []
    );
    const [_loadingCloudInfo, cloudInfo] = useAsync(
        async () => (contexts ? ipc.cloud.augmentK8sContexts(contexts) : {}),
        [contexts]
    );

    const metaKeyPressedRef = useModifierKeyRef("Meta");

    const contextOptions: ContextOption[] = useMemo(
        () =>
            contexts?.map((context) => ({
                ...context,
                ...(cloudInfo?.[context.name] ?? null),
                bestAccountId:
                    cloudInfo?.[context.name]?.accounts?.[0].accountId,
                bestAccountName:
                    cloudInfo?.[context.name]?.accounts?.[0].accountName,
                value: context.name,
                label:
                    cloudInfo?.[context.name]?.localClusterName ?? context.name,
            })) ?? [],
        [contexts, cloudInfo]
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

    const selectValue = useMemo(
        () => contextOptions.find((context) => context.value === kubeContext),
        [contextOptions, kubeContext]
    );
    const onChangeSelect = useCallback(
        (value: ContextOption | null | undefined) => {
            if (value) {
                if (metaKeyPressedRef.current) {
                    ipc.app.createWindow({
                        context: value.name,
                    });
                } else {
                    kubeContextStore.set(value.name);
                }
            }
        },
        [kubeContextStore]
    );

    return (
        <Box {...boxProps}>
            <Heading>{selectValue?.localClusterName ?? kubeContext}</Heading>
            <Select
                value={selectValue}
                onChange={onChangeSelect}
                options={groupedContextOptions}
                filterOption={filterOption}
            ></Select>
        </Box>
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

function filterOption(option: { data: ContextOption }, input: string): boolean {
    const context = option.data;
    return searchMatch(
        input,
        [
            context.name,
            context.cloudProvider,
            context.cloudService,
            context.region,
            context.bestAccountId,
            context.bestAccountName,
            context.localClusterName,
        ]
            .filter((x) => x)
            .join(" ")
    );
}
