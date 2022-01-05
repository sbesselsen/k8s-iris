import {
    Box,
    ChakraComponent,
    Heading,
    Radio,
    RadioGroup,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { groupByKeys } from "../../common/util/group";
import { k8sSmartCompare } from "../../common/util/sort";
import { useK8sContext, useK8sContextStore } from "../context/k8s-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";

type ContextWithCloudInfo = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
    };

export const K8sContextSelector: ChakraComponent<"div"> = (props) => {
    const boxProps = props;

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

    const onMetaSelect = useCallback(
        (context: string) => {
            ipc.app.createWindow({ context });
        },
        [ipc]
    );

    const contextsWithCloudInfo: ContextWithCloudInfo[] = useMemo(
        () =>
            contexts?.map((context) => ({
                ...context,
                ...(cloudInfo?.[context.name] ?? null),
                bestAccountId:
                    cloudInfo?.[context.name]?.accounts?.[0].accountId,
                bestAccountName:
                    cloudInfo?.[context.name]?.accounts?.[0].accountName,
            })) ?? [],
        [contexts, cloudInfo]
    );

    const groupedContexts = useMemo(
        () =>
            groupByKeys(
                contextsWithCloudInfo,
                [
                    "cloudProvider",
                    "cloudService",
                    "bestAccountName",
                    "bestAccountId",
                    "region",
                ],
                (_, a, b) => k8sSmartCompare(a, b)
            ).map(
                ([group, contexts]) =>
                    [
                        group,
                        contexts.sort((a, b) =>
                            k8sSmartCompare(
                                a.localClusterName ?? a.name,
                                b.localClusterName ?? b.name
                            )
                        ),
                    ] as [Partial<CloudK8sContextInfo>, ContextWithCloudInfo[]]
            ),
        [contextsWithCloudInfo]
    );

    return (
        <Box {...boxProps}>
            <RadioGroup
                value={kubeContext}
                onChange={kubeContextStore.set as (value: string) => void}
            >
                <VStack spacing={0}>
                    {groupedContexts.map(([group, contexts]) => (
                        <Box width="100%">
                            <K8sContextSelectorGroupHeading group={group} />
                            <VStack spacing={1}>
                                {contexts.map((context) => (
                                    <K8sContextSelectorItem
                                        key={context.name}
                                        contextWithCloudInfo={context}
                                        onMetaSelect={onMetaSelect}
                                    />
                                ))}
                            </VStack>
                        </Box>
                    ))}
                </VStack>
            </RadioGroup>
        </Box>
    );
};

const K8sContextSelectorGroupHeading: React.FC<{
    group: Partial<ContextWithCloudInfo>;
}> = (props) => {
    const { group } = props;
    if (Object.keys(group).length === 0) {
        // This group has no identity of its own.
        return null;
    }

    const headingParts: string[] = [
        group.cloudProvider,
        group.cloudService,
        group.bestAccountName ?? group.bestAccountId,
        group.region,
    ].filter((x) => x);
    return (
        <Heading
            color="gray.500"
            letterSpacing="wide"
            textTransform="uppercase"
            size="xs"
            fontSize="xs"
            marginTop={3}
            marginBottom={1}
            isTruncated
        >
            {headingParts.join(" • ")}
        </Heading>
    );
};

const K8sContextSelectorItem: React.FC<{
    contextWithCloudInfo: ContextWithCloudInfo;
    onMetaSelect?: (name: string) => void;
}> = (props) => {
    const { contextWithCloudInfo: context, onMetaSelect } = props;

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.getModifierState("Meta")) {
                onMetaSelect(context.name);
                e.preventDefault();
                e.stopPropagation();
            }
        },
        [context, onMetaSelect]
    );

    const localName = context.localClusterName ?? context.name;

    return (
        <Box onClickCapture={onClick} justifyContent="flex-start" width="100%">
            <Radio value={context.name}>{localName}</Radio>
        </Box>
    );
};
