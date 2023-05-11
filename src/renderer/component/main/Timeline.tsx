import { Table, TableProps, Td, Th, Thead, Tr } from "@chakra-ui/react";
import React, { ReactNode, useMemo } from "react";
import { leftPad } from "../../../common/util/pad";
import { formatDeveloperDate } from "../../util/date";
import { ScrollBoxHorizontalScroll } from "./ScrollBox";
import { Selectable } from "./Selectable";
import { ViewportLazyTbody } from "./ViewportLazyTbody";

export type TimelineEvent = {
    id: string;
    when: Date;
    content: ReactNode;
};

export type TimelineProps = TableProps & {
    sort?: "newest-first" | "oldest-first" | "none";
    events: TimelineEvent[];
};

function formatEventDateTime(date: Date): string {
    const now = new Date();
    const dateString = date.toLocaleDateString();
    const timeString =
        leftPad(String(date.getHours()), "0", 2) +
        ":" +
        leftPad(String(date.getMinutes()), "0", 2) +
        ":" +
        leftPad(String(date.getSeconds()), "0", 2);
    if (dateString === now.toLocaleDateString()) {
        return timeString;
    }
    return formatDeveloperDate(date) + " " + timeString;
}

export const Timeline: React.FC<TimelineProps> = (props) => {
    const { events, sort = "newest-first", ...tableProps } = props;

    const sortedEvents = useMemo(() => {
        if (sort === "none") {
            return events;
        }
        const order = sort === "newest-first" ? 1 : -1;
        return [...events].sort(
            (x, y) => order & (x.when.getTime() - y.when.getTime())
        );
    }, [events, sort]);

    return (
        <ScrollBoxHorizontalScroll>
            <Table
                size="sm"
                sx={{ tableLayout: "fixed" }}
                minWidth="400px"
                {...tableProps}
            >
                <Thead>
                    <Tr>
                        <Th ps={2} whiteSpace="nowrap" width="100px">
                            Time
                        </Th>
                        <Th whiteSpace="nowrap">Event</Th>
                    </Tr>
                </Thead>
                <ViewportLazyTbody
                    chunkSize={10}
                    rootMargin="1000px"
                    defaultHeight="100px"
                >
                    {sortedEvents.map((event) => (
                        <Tr key={event.id}>
                            <Td
                                ps={2}
                                borderBottom="none"
                                verticalAlign="baseline"
                            >
                                <Selectable>
                                    {formatEventDateTime(event.when)}
                                </Selectable>
                            </Td>
                            <Td borderBottom="none" verticalAlign="baseline">
                                {event.content}
                            </Td>
                        </Tr>
                    ))}
                </ViewportLazyTbody>
            </Table>
        </ScrollBoxHorizontalScroll>
    );
};
