import React from "react";

import { List, ListItem, Tag, TagLabel, TagLeftIcon } from "@chakra-ui/react";
import { FaAws } from "react-icons/fa";

import { useK8sListWatch } from "../../k8s/list-watch";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";

import { Table, Tbody, Tr, Th, Td, Box, Text } from "@chakra-ui/react";
import { useK8sContext } from "../../context/k8s-context";
import { IconType } from "react-icons";

const SelectableText: React.FC<{}> = ({ children }) => {
    return <Text userSelect="text">{children}</Text>;
};

const StatTh: React.FC<{}> = ({ children, ...props }) => {
    return (
        <Th
            width="0"
            whiteSpace="nowrap"
            textAlign="left"
            verticalAlign="baseline"
            {...props}
        >
            {children}
        </Th>
    );
};
const StatTd: React.FC<{}> = ({ children, ...props }) => {
    return (
        <Td verticalAlign="baseline" {...props}>
            <SelectableText>{children}</SelectableText>
        </Td>
    );
};

const icons: Record<string, { icon?: IconType; colorScheme: string }> = {
    aws: {
        icon: FaAws,
        colorScheme: "yellow",
    },
};

export const ClusterInfoOverview: React.FC<{}> = () => {
    const [_loadingNodes, nodes, _nodesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Node",
        },
        []
    );

    const context = useK8sContext();

    const [_loadingContexts, contextsInfo] = useK8sContextsInfo(true);
    const contextInfo = contextsInfo.find((info) => info.name === context);

    console.log({ contextInfo });

    const cloudProviderIconProps = contextInfo.cloudInfo.cloudProvider
        ? icons[contextInfo.cloudInfo.cloudProvider]
        : null;

    return (
        <Box p={2}>
            <Table>
                <Tbody>
                    <Tr>
                        <StatTh>Context</StatTh>
                        <StatTd>{contextInfo.name}</StatTd>
                    </Tr>
                    {contextInfo.cluster !== contextInfo.name && (
                        <Tr>
                            <StatTh>Cluster</StatTh>
                            <StatTd>{contextInfo.cluster}</StatTd>
                        </Tr>
                    )}
                    {contextInfo.user !== contextInfo.name && (
                        <Tr>
                            <StatTh>User</StatTh>
                            <StatTd>{contextInfo.user}</StatTd>
                        </Tr>
                    )}
                    {contextInfo?.cloudInfo?.cloudProvider && (
                        <Tr>
                            <StatTh>Cloud provider</StatTh>
                            <StatTd>
                                <Tag
                                    size="sm"
                                    colorScheme={
                                        cloudProviderIconProps?.colorScheme
                                    }
                                >
                                    {cloudProviderIconProps?.icon && (
                                        <TagLeftIcon
                                            as={cloudProviderIconProps?.icon}
                                        />
                                    )}

                                    <TagLabel
                                        textTransform="uppercase"
                                        fontWeight="semibold"
                                        letterSpacing="wide"
                                        fontSize="xs"
                                    >
                                        {[
                                            contextInfo.cloudInfo.cloudProvider,
                                            contextInfo.cloudInfo.cloudService,
                                        ]
                                            .filter((t) => t)
                                            .join(" / ")}
                                    </TagLabel>
                                </Tag>
                            </StatTd>
                        </Tr>
                    )}
                    {contextInfo.cloudInfo?.region && (
                        <Tr>
                            <StatTh>Cloud region</StatTh>
                            <StatTd>{contextInfo.cloudInfo?.region}</StatTd>
                        </Tr>
                    )}
                    {contextInfo.cloudInfo?.accounts?.length > 0 && (
                        <Tr>
                            <StatTh>Cloud accounts</StatTh>
                            <StatTd>
                                <List>
                                    {contextInfo.cloudInfo.accounts.map(
                                        (account, i) => (
                                            <ListItem key={i}>
                                                <SelectableText>
                                                    {[
                                                        account.accountId,
                                                        account.accountName,
                                                    ]
                                                        .filter((t) => t)
                                                        .join(" / ")}
                                                </SelectableText>
                                            </ListItem>
                                        )
                                    )}
                                </List>
                            </StatTd>
                        </Tr>
                    )}
                    <Tr>
                        <StatTh>Number of nodes</StatTh>
                        <StatTd>{nodes?.items.length ?? "..."}</StatTd>
                    </Tr>
                </Tbody>
            </Table>
        </Box>
    );
};
