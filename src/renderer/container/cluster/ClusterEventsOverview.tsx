import React, { MutableRefObject, useMemo, useRef } from "react";

import { ScrollBox } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { useK8sContext } from "../../context/k8s-context";
import {
    Badge,
    Heading,
    Table,
    TableCellProps,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useColorModeValue,
} from "@chakra-ui/react";
import { Selectable } from "../../component/main/Selectable";
import { K8sObject } from "../../../common/k8s/client";

export const ClusterEventsOverview: React.FC = () => {
    const [_loadingEvents, events, _eventsError] = useK8sListWatch(
        {
            apiVersion: "events.k8s.io/v1",
            kind: "Event",
        },
        {
            updateCoalesceInterval: 5000,
        },
        []
    );

    const sortedEvents = useMemo(() => {
        return [...(events?.items ?? [])]
            .sort((x: any, y: any) => {
                if (x.deprecatedLastTimestamp && y.deprecatedLastTimestamp) {
                    return (x.deprecatedLastTimestamp as string).localeCompare(
                        y.deprecatedLastTimestamp,
                        undefined,
                        { numeric: true }
                    );
                } else if (
                    x.metadata?.creationTimestamp &&
                    y.metadata?.creationTimestamp
                ) {
                    return (
                        x.metadata.creationTimestamp as string
                    ).localeCompare(y.metadata.creationTimestamp, undefined, {
                        numeric: true,
                    });
                } else {
                    return (x.metadata.uid as string).localeCompare(
                        y.metadata.uid,
                        undefined,
                        { numeric: true }
                    );
                }
            })
            .reverse()
            .slice(0, 50);
    }, [events]);

    const tableRef = useRef<HTMLTableElement>();

    return (
        <ScrollBox px={4} position="relative">
            <Table size="sm" ref={tableRef} m={0}>
                <Thead>
                    <Tr>
                        <EventTh w={1}>Last seen</EventTh>
                        <EventTh w={1}>Count</EventTh>
                        <EventTh w={1}>Namespace</EventTh>
                        <EventTh w={1}>Type</EventTh>
                        <EventTh w="100%">Message</EventTh>
                    </Tr>
                </Thead>
                <Tbody>
                    {sortedEvents.map((event: any) => (
                        <EventRow
                            key={event.metadata.uid}
                            event={event}
                            tableRef={tableRef}
                        />
                    ))}
                </Tbody>
            </Table>
        </ScrollBox>
    );
};

const EventRow: React.FC<{
    event: any;
    tableRef: MutableRefObject<HTMLElement>;
}> = React.memo((props) => {
    const { event, tableRef } = props;

    console.log("render event 2");

    return (
        <Tr>
            {/*
        <EventTd>
            <Selectable containerRef={tableRef}>
                <Datetime
                    value={
                        event.deprecatedCount > 1
                            ? event.deprecatedFirstTimestamp
                            : event.metadata
                                  .creationTimestamp
                    }
                />
            </Selectable>
                </EventTd>*/}
            <EventTd>
                <Selectable containerRef={tableRef}>
                    <Datetime value={event.deprecatedLastTimestamp} />
                </Selectable>
            </EventTd>
            <EventTd>
                <Selectable containerRef={tableRef}>
                    {event.deprecatedCount > 1 ? event.deprecatedCount : ""}
                </Selectable>
            </EventTd>
            <EventTd>
                <Selectable containerRef={tableRef}>
                    {event.metadata?.namespace ?? ""}
                </Selectable>
            </EventTd>
            <EventTd>
                {event.type === "Normal" && <Badge>{event.type}</Badge>}
                {event.type === "Warning" && (
                    <Badge colorScheme="red">{event.type}</Badge>
                )}
                {event.type !== "Normal" && event.type !== "Warning" && (
                    <Badge colorScheme="purple">{event.type}</Badge>
                )}
            </EventTd>
            <EventTd>
                <Selectable containerRef={tableRef}>{event.note}</Selectable>
            </EventTd>
        </Tr>
    );
});

const EventTh: React.FC<TableCellProps> = ({ children, ...props }) => {
    const contentBackground = useColorModeValue("white", "gray.900");

    return (
        <Th
            width="0"
            whiteSpace="nowrap"
            textAlign="left"
            verticalAlign="baseline"
            ps={0}
            py={2}
            position="sticky"
            top={0}
            bg={contentBackground}
            {...props}
        >
            <Text isTruncated>{children}</Text>
        </Th>
    );
};

const EventTd: React.FC<TableCellProps> = ({ children, ...props }) => {
    return (
        <Td verticalAlign="baseline" ps={0} py={2} {...props}>
            <Text isTruncated>{children}&nbsp;</Text>
        </Td>
    );
};

const Datetime: React.FC<{ value: string | null | undefined }> = (props) => {
    const { value } = props;

    const parsedDate = Date.parse(value ?? "");
    if (isNaN(parsedDate)) {
        return null;
    }

    const now = new Date();
    const currentDateString = now.toLocaleDateString(undefined);

    const date = new Date(parsedDate);
    const timeString = date.toLocaleTimeString(undefined, { hour12: false });
    let dateString = date.toLocaleDateString(undefined, { hour12: false });
    if (dateString === currentDateString) {
        dateString = "today";
    }

    return (
        <>
            {dateString}, {timeString}
        </>
    );
};
