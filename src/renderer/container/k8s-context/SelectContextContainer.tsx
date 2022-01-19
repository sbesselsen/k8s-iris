import { Text } from "@chakra-ui/react";
import { ChakraStylesConfig, Select } from "chakra-react-select";
import React, { useCallback, useMemo } from "react";
import { CloudK8sContextInfo } from "../../../common/cloud/k8s";
import { K8sContext } from "../../../common/k8s/client";
import { groupByKeys } from "../../../common/util/group";
import { searchMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { useAsync } from "../../hook/async";
import { useIpc } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { sleep } from "../../../common/util/async";

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

type SelectContextContainerProps = {
    chakraStyles?: ChakraStylesConfig;
    selectedContext?: string | undefined;
    onSelectContext?: (context: string, requestNewWindow: boolean) => void;
};

export const SelectContextContainer: React.FC<SelectContextContainerProps> = (
    props
) => {
    const { chakraStyles, onSelectContext, selectedContext } = props;

    const ipc = useIpc();

    const [isLoadingContexts, contexts] = useAsync(
        () => ipc.k8s.listContexts(),
        []
    );
    const [isLoadingCloudInfo, cloudInfo] = useAsync(async () => {
        await sleep(2000);
        return contexts ? ipc.cloud.augmentK8sContexts(contexts) : {};
    }, [contexts]);

    const isLoading = isLoadingContexts || isLoadingCloudInfo;

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
        () =>
            contextOptions.find((context) => context.value === selectedContext),
        [contextOptions, selectedContext]
    );
    const onChangeSelect = useCallback(
        (value: ContextOption | null | undefined) => {
            if (value) {
                onSelectContext?.(value.name, metaKeyPressedRef.current);
            }
        },
        [onSelectContext]
    );

    return (
        <Select
            selectedOptionStyle="check"
            value={selectValue}
            onChange={onChangeSelect}
            options={isLoading ? [] : groupedContextOptions}
            autoFocus={true}
            menuIsOpen={true}
            filterOption={filterOption}
            formatGroupLabel={formatGroupLabel}
            components={selectComponents}
            chakraStyles={chakraStyles}
            isLoading={isLoading}
        />
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
