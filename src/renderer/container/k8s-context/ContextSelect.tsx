import { Text } from "@chakra-ui/react";
import { ChakraStylesConfig, Select } from "chakra-react-select";
import React, { useCallback, useMemo } from "react";
import { CloudK8sContextInfo } from "../../../common/cloud/k8s";
import { K8sContext } from "../../../common/k8s/client";
import { groupByKeys } from "../../../common/util/group";
import { searchMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { useModifierKeyRef } from "../../hook/keyboard";

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

type ContextSelectProps = {
    chakraStyles?: ChakraStylesConfig;
    selectedContext?: string | undefined;
    onSelectContext?: (context: string, requestNewWindow: boolean) => void;
};

export const ContextSelect: React.FC<ContextSelectProps> = (props) => {
    const { chakraStyles, onSelectContext, selectedContext } = props;

    const [isLoading, contextsInfo] = useK8sContextsInfo(true);

    const metaKeyPressedRef = useModifierKeyRef("Meta");

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
