import { Box, Button, Heading, Icon, Text, VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { MdCheckCircle } from "react-icons/md";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { groupByKeys } from "../../common/util/group";
import { k8sSmartCompare } from "../../common/util/sort";
import { useK8sContext, useK8sContextStore } from "../context/k8s-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";

export const K8sContextSelector: React.FC = () => {
    const kubeContext = useK8sContext();
    const kubeContextStore = useK8sContextStore();

    const ipc = useIpc();

    const [loadingContexts, allContexts] = useAsync(
        () => ipc.k8s.listContexts(),
        []
    );
    const [loadingCloudInfo, cloudInfo] = useAsync(
        async () =>
            allContexts ? ipc.cloud.augmentK8sContexts(allContexts) : {},
        [allContexts]
    );

    const loading = loadingContexts || loadingCloudInfo;

    const onSelect = useCallback(
        (context: string, requestNewWindow: boolean) => {
            if (requestNewWindow) {
                ipc.app.createWindow({ context });
            } else {
                kubeContextStore.set(context);
            }
        },
        [kubeContextStore]
    );

    return (
        <>
            {loading && (
                <>
                    <Text color="gray.500">{kubeContext}</Text>
                </>
            )}
            {!loading && (
                <K8sContextSelectorList
                    kubeContext={kubeContext}
                    contexts={allContexts}
                    cloudInfo={cloudInfo}
                    onSelect={onSelect}
                />
            )}
        </>
    );
};

type K8sContextSelectorListProps = {
    kubeContext: string;
    contexts: K8sContext[];
    cloudInfo: Record<string, CloudK8sContextInfo>;
    onSelect: (context: string, requestNewWindow: boolean) => void;
};

type ContextWithCloudInfo = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
    };

const K8sContextSelectorList: React.FC<K8sContextSelectorListProps> = (
    props
) => {
    const { kubeContext, contexts, cloudInfo, onSelect } = props;

    const contextsWithCloudInfo: ContextWithCloudInfo[] = useMemo(
        () =>
            contexts.map((context) => ({
                ...context,
                ...(cloudInfo[context.name] ?? null),
                bestAccountId: cloudInfo[context.name]?.accounts?.[0].accountId,
                bestAccountName:
                    cloudInfo[context.name]?.accounts?.[0].accountName,
            })),
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
        <VStack spacing={0}>
            {groupedContexts.map(([group, contexts]) => (
                <Box width="100%">
                    <K8sContextSelectorGroupHeading group={group} />
                    <VStack spacing={0}>
                        {contexts.map((context) => (
                            <K8sContextSelectorItem
                                key={context.name}
                                kubeContext={kubeContext}
                                contextWithCloudInfo={context}
                                onSelect={onSelect}
                            />
                        ))}
                    </VStack>
                </Box>
            ))}
        </VStack>
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
            marginStart={2}
            isTruncated
        >
            {headingParts.join(" • ")}
        </Heading>
    );
};

const K8sContextSelectorItem: React.FC<{
    kubeContext: string;
    contextWithCloudInfo: ContextWithCloudInfo;
    onSelect?: (name: string, requestNewWindow: boolean) => void;
}> = (props) => {
    const { kubeContext, contextWithCloudInfo: context, onSelect } = props;

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            onSelect(context.name, e.getModifierState("Meta"));
        },
        [onSelect, context]
    );

    const isSelected = context.name === kubeContext;
    const localName = context.localClusterName ?? context.name;
    const icon = isSelected ? (
        <Icon as={MdCheckCircle} color="green.500" />
    ) : null;

    return (
        <Button
            onClick={onClick}
            bgColor="transparent"
            borderRadius={0}
            isFullWidth={true}
            size="xs"
            padingY={2}
            paddingStart={4}
            fontWeight="normal"
            justifyContent="flex-start"
            leftIcon={icon}
        >
            {localName}
        </Button>
    );
};
