import React, { MutableRefObject, useMemo, useRef } from "react";

import { ScrollBox } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import {
    Badge,
    BadgeProps,
    Box,
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
                        <EventTh w="170px">Last seen</EventTh>
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

const eventTypeBadgeProps: Record<string, BadgeProps> = {
    _: { colorScheme: "primary" },
    Normal: {},
    Warning: { colorScheme: "red" },
};

const EventRow: React.FC<{
    event: any;
    tableRef: MutableRefObject<HTMLElement>;
}> = React.memo((props) => {
    const { event, tableRef } = props;

    const typeBadgeProps: BadgeProps =
        eventTypeBadgeProps[event.type] ?? eventTypeBadgeProps["_"];
    const typeBadge = <Badge {...typeBadgeProps}>{event.type}</Badge>;

    return (
        <Tr>
            <EventTd>
                <Selectable containerRef={tableRef}>
                    <Datetime value={event.deprecatedLastTimestamp} />
                </Selectable>
            </EventTd>
            <EventTd wrapText={false}>
                <Box mb={1}>
                    <Selectable containerRef={tableRef} lineHeight="1.3">
                        {event.type !== "Normal" && typeBadge}{" "}
                        {event.deprecatedCount > 1 ? (
                            <Badge textTransform="none">
                                {event.deprecatedCount}x
                            </Badge>
                        ) : (
                            ""
                        )}{" "}
                        {event.note}
                    </Selectable>
                </Box>
                <Text fontSize="xs" fontWeight="bold">
                    {event?.regarding?.kind}:{" "}
                    {event?.metadata?.namespace &&
                        `${event.metadata.namespace}/`}
                    {event?.regarding?.name}
                </Text>
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

const EventTd: React.FC<TableCellProps & { wrapText?: boolean }> = ({
    children,
    wrapText = true,
    ...props
}) => {
    return (
        <Td verticalAlign="baseline" ps={0} py={2} {...props}>
            {wrapText ? <Text isTruncated>{children}&nbsp;</Text> : children}
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
