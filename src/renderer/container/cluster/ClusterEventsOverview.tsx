import React, { MutableRefObject, useMemo, useRef } from "react";

import { ScrollBox } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import {
    Badge,
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
import { useK8sNamespaces } from "../../context/k8s-namespaces";

export const ClusterEventsOverview: React.FC = () => {
    const namespaces = useK8sNamespaces();

    const [_loadingEvents, events, _eventsError] = useK8sListWatch(
        {
            apiVersion: "events.k8s.io/v1",
            kind: "Event",
            ...(namespaces.mode === "all"
                ? {}
                : { namespaces: namespaces.selected }),
        },
        {
            updateCoalesceInterval: 5000,
        },
        [namespaces]
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
        <ScrollBox px={4} pb={10} w="100%">
            <Table size="sm" ref={tableRef} m={0} sx={{ tableLayout: "fixed" }}>
                <Thead>
                    <Tr>
                        <EventTh w="150px">Last seen</EventTh>
                        <EventTh w="70px">Count</EventTh>
                        <EventTh w="150px">Namespace</EventTh>
                        <EventTh w="100px">Type</EventTh>
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
                <Selectable containerRef={tableRef} isTruncated>
                    {event.note}
                </Selectable>
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
