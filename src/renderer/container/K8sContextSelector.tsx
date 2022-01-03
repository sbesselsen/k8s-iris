import {
    Box,
    Heading,
    Icon,
    Spinner,
    StackDivider,
    Tag,
    Text,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { FaAws, FaCode } from "react-icons/fa";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { K8sContextLabel } from "../component/K8sContextLabel";
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
        (context: string) => {
            kubeContextStore.set(context);
        },
        [kubeContextStore]
    );

    return (
        <>
            {loading && (
                <>
                    <Spinner />
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
    onSelect: (context: string) => void;
};

const chooseBestAccount = (
    accounts: CloudK8sContextInfo["accounts"]
): CloudK8sContextInfo["accounts"][number] => {
    // TODO
    const [account] = accounts;
    return account;
};

export const K8sContextSelectorList: React.FC<K8sContextSelectorListProps> = (
    props
) => {
    const { kubeContext, contexts, cloudInfo, onSelect } = props;

    // Group the items.
    const groupedContexts = useMemo(() => {
        const groups: Record<
            string,
            {
                group: CloudK8sContextInfo;
                sortId: string;
                contexts: K8sContext[];
            }
        > = {};

        for (const context of contexts) {
            const contextCloudInfo = cloudInfo[context.name] ?? {};
            const bestAccount =
                contextCloudInfo.accounts?.length > 0
                    ? chooseBestAccount(contextCloudInfo.accounts)
                    : null;
            const groupIdParts = [
                contextCloudInfo.cloudProvider ?? "",
                contextCloudInfo.cloudService ?? "",
                contextCloudInfo.region ?? "",
                bestAccount?.accountId ?? "",
            ];
            const groupId = groupIdParts.join("/");
            const sortId = bestAccount?.accountName ?? "ZZZZZZZZZZZZZZZZ";
            const accounts = bestAccount
                ? [
                      bestAccount,
                      ...(contextCloudInfo?.accounts.filter(
                          (account) =>
                              account.accountId !== bestAccount.accountId
                      ) ?? []),
                  ]
                : [];
            const group: CloudK8sContextInfo = {
                ...contextCloudInfo,
                accounts,
            };
            if (!groups[groupId]) {
                groups[groupId] = {
                    group,
                    sortId,
                    contexts: [],
                };
            }
            groups[groupId].contexts.push(context);
        }

        return Object.entries(groups)
            .sort(([_k1, a], [_k2, b]) =>
                a.sortId.localeCompare(b.sortId, undefined, {
                    sensitivity: "base",
                    ignorePunctuation: true,
                    numeric: true,
                })
            )
            .map(([_, v]) => v);
    }, [contexts, cloudInfo]);

    return (
        <VStack spacing={0} divider={<StackDivider />}>
            {groupedContexts.map((group) => (
                <Box width="100%">
                    <K8sContextSelectorGroupHeading group={group.group} />
                    <VStack spacing={0}>
                        {group.contexts.map((context) => (
                            <K8sContextSelectorItem
                                key={context.name}
                                kubeContext={kubeContext}
                                contexts={contexts}
                                context={context}
                                cloudInfo={cloudInfo}
                                onSelect={onSelect}
                            />
                        ))}
                    </VStack>
                </Box>
            ))}
        </VStack>
    );
};

export const K8sContextSelectorGroupHeading: React.FC<{
    group: CloudK8sContextInfo;
}> = (props) => {
    const { group } = props;
    if (!group.cloudProvider) {
        return null;
    }

    const icon = useMemo(() => {
        switch (group.cloudProvider) {
            case "aws":
                return <Icon as={FaAws} marginEnd={1} />;
            case "local":
                return <Icon as={FaCode} marginEnd={1} />;
            default:
                return null;
        }
    }, [group]);

    const tags = useMemo(() => {
        const tags: React.ReactElement[] = [];
        if (group.cloudService) {
            tags.push(<Tag key="cloudService">{group.cloudService}</Tag>);
        }
        if (group.region) {
            tags.push(<Tag key="region">{group.region}</Tag>);
        }
        if (group.accounts?.length > 0) {
            const [, ...otherAccounts] = group.accounts;
            tags.push(
                ...otherAccounts.map(({ accountId, accountName }) => (
                    <Tag key={`account-${accountId}`}>
                        {accountName
                            ? `${accountName} (${accountId})`
                            : accountId}
                    </Tag>
                ))
            );
        }
        return tags;
    }, [group]);

    let name = [group.cloudProvider, group.cloudService]
        .filter((x) => x)
        .join(" ");
    if (group.accounts?.length > 0) {
        const [{ accountId, accountName }] = group.accounts;
        name = accountName ? `${accountName} (${accountId})` : accountId;
    }

    return (
        <Heading size={"xs"} verticalAlign="middle">
            {icon} {name} {tags}
        </Heading>
    );
};

export const K8sContextSelectorItem: React.FC<
    K8sContextSelectorListProps & { context: K8sContext }
> = (props) => {
    const { kubeContext, context, cloudInfo, onSelect } = props;

    const onClick = useCallback(() => {
        onSelect(context.name);
    }, [onSelect, context]);

    return (
        <K8sContextLabel
            context={context}
            cloudInfo={cloudInfo[context.name]}
            isSelected={context.name === kubeContext}
            onClick={onClick}
        />
    );
};
