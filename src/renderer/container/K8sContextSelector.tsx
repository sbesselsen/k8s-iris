import { Text } from "@chakra-ui/react";
import { ChakraStylesConfig, Select } from "chakra-react-select";
import React, { Fragment, useCallback, useMemo } from "react";
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

const selectComponents = {
    DropdownIndicator: null,
};

export const K8sContextSelector: React.FC = () => {
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

    const chakraStyles: ChakraStylesConfig = useMemo(
        () => ({
            control: (provided, _state) => {
                const selectedValueText = (
                    selectValue?.localClusterName ??
                    selectValue?.name ??
                    ""
                ).length;
                return {
                    ...provided,
                    border: 0,
                    minWidth: selectedValueText + "em",
                };
            },
            menu: (provided, _state) => {
                return {
                    ...provided,
                    minWidth: "min(250px, 100vw)",
                };
            },
        }),
        [selectValue]
    );

    return (
        <Fragment>
            <Select
                size="sm"
                value={selectValue}
                onChange={onChangeSelect}
                options={groupedContextOptions}
                filterOption={filterOption}
                formatGroupLabel={formatGroupLabel}
                chakraStyles={chakraStyles}
                components={selectComponents}
            ></Select>
        </Fragment>
    );
};

function formatGroupLabel(props: { label: string }): React.ReactNode {
    const { label } = props;
    return (
        <Text
            color="gray.500"
            fontWeight="semibold"
            letterSpacing="wide"
            fontSize="xs"
            textTransform="uppercase"
        >
            {label}
        </Text>
    );
}

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
