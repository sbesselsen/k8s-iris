import React, { Fragment, useMemo } from "react";

import {
    Badge,
    Heading,
    List,
    ListItem,
    Tag,
    TagLabel,
    TagLeftIcon,
} from "@chakra-ui/react";

import { FaAws } from "react-icons/fa";

import { stickToTop } from "react-unstuck";

import { useK8sListWatch } from "../../k8s/list-watch";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";

import { K8sObject } from "../../../common/k8s/client";

import { Table, Thead, Tbody, Tr, Th, Td, Box, Text } from "@chakra-ui/react";
import { useK8sContext } from "../../context/k8s-context";
import { IconType } from "react-icons";
import { AppSticky } from "../../component/ChakraSticky";

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
            ps={4}
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

    const [_loadingEvents, events, _eventsError] = useK8sListWatch(
        {
            apiVersion: "events.k8s.io/v1",
            kind: "Event",
        },
        []
    );

    console.log({ events });

    const context = useK8sContext();

    const [_loadingContexts, contextsInfo] = useK8sContextsInfo(true);
    const contextInfo = contextsInfo.find((info) => info.name === context);

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
            {<EventList events={events?.items ?? []} />}
        </Box>
    );
};

const EventList: React.FC<{ events: K8sObject[] }> = (props) => {
    const { events } = props;

    const sortedEvents = useMemo(() => {
        return [...events].reverse();
    }, [events]);

    return (
        <Box mt={12}>
            <AppSticky behavior={stickToTop}>
                <Heading p={4} variant="eyecatcher" fontSize="lg">
                    Events
                </Heading>
            </AppSticky>
            <Table size="sm">
                <Thead>
                    <Th>Timestamp</Th>
                    <Th>Type</Th>
                    <Th>Message</Th>
                </Thead>
                <Tbody>
                    {sortedEvents.map((event: any) => (
                        <Tr key={event.metadata.uid}>
                            <StatTd>
                                {event.deprecatedCount > 1 && (
                                    <Fragment>
                                        {event.deprecatedFirstTimestamp} -{" "}
                                        {event.deprecatedLastTimestamp} (
                                        {event.deprecatedCount})
                                    </Fragment>
                                )}
                                {!(event.deprecatedCount > 1) &&
                                    event.metadata.creationTimestamp}
                            </StatTd>
                            <StatTd>
                                {event.type === "Normal" && (
                                    <Badge>{event.type}</Badge>
                                )}
                                {event.type === "Warning" && (
                                    <Badge colorScheme="red">
                                        {event.type}
                                    </Badge>
                                )}
                                {event.type !== "Normal" &&
                                    event.type !== "Warning" && (
                                        <Badge colorScheme="purple">
                                            {event.type}
                                        </Badge>
                                    )}
                            </StatTd>
                            <StatTd>{event.note}</StatTd>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </Box>
    );
};
