import {
    Button,
    ChakraComponent,
    Heading,
    Icon,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { MdCheckCircle } from "react-icons/md";
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

    const onClick = useCallback(
        (context: string, requestNewWindow: boolean) => {
            if (requestNewWindow) {
                ipc.app.createWindow({ context });
            } else {
                kubeContextStore.set(context);
            }
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
        <VStack spacing={4} width="100%" alignItems="start">
            {groupedContexts.map(([group, contexts]) => (
                <>
                    <VStack spacing={1} alignItems="start">
                        <K8sContextSelectorGroupHeading group={group} />
                        {contexts.map((context) => (
                            <K8sContextSelectorItem
                                key={context.name}
                                currentContext={kubeContext}
                                contextWithCloudInfo={context}
                                onClick={onClick}
                            />
                        ))}
                    </VStack>
                </>
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
            isTruncated
        >
            {headingParts.join(" • ")}
        </Heading>
    );
};

const K8sContextSelectorItem: React.FC<{
    currentContext: string;
    contextWithCloudInfo: ContextWithCloudInfo;
    onClick?: (name: string, requestNewWindow: boolean) => void;
}> = (props) => {
    const { contextWithCloudInfo: context, currentContext, onClick } = props;

    const onButtonClick = useCallback(
        (e: React.MouseEvent) => {
            onClick(context.name, e.getModifierState("Meta"));
        },
        [context, onClick]
    );

    const localName = context.localClusterName ?? context.name;

    return (
        <Button
            onClick={onButtonClick}
            variant="link"
            fontWeight="normal"
            textColor="gray.800"
            py={1}
            leftIcon={
                currentContext === context.name ? (
                    <Icon as={MdCheckCircle} color="green.500" />
                ) : null
            }
        >
            {localName}
        </Button>
    );
};
