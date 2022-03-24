import { Box, BoxProps, useColorModeValue } from "@chakra-ui/react";
import React, { ReactNode, useMemo } from "react";
import { Selectable } from "./Selectable";

export type TimelineEvent = {
    id: string;
    when: Date;
    content: ReactNode;
};

export type TimelineProps = BoxProps & {
    sort?: "newest-first" | "oldest-first" | "none";
    events: TimelineEvent[];
};

export const Timeline: React.FC<TimelineProps> = (props) => {
    const { events, sort = "newest-first", ...boxProps } = props;

    const lineColor = useColorModeValue("gray.200", "gray.700");

    // TODO: sort events
    const sortedEvents = useMemo(() => {
        if (sort === "none") {
            return events;
        }
        const order = sort === "newest-first" ? 1 : -1;
        return [...events].sort(
            (x, y) => order & (x.when.getTime() - y.when.getTime())
        );
    }, [events, sort]);

    const renderItems: ReactNode[] = [];
    let prevDateString = new Date().toDateString();
    for (const event of sortedEvents) {
        const dateString = event.when.toDateString();
        if (dateString !== prevDateString) {
            renderItems.push(
                <TimelineDateMarker
                    date={event.when}
                    key={`marker-${event.id}`}
                    lineColor={lineColor}
                />
            );
            prevDateString = dateString;
        }
        renderItems.push(
            <TimelineItem
                event={event}
                lineColor={lineColor}
                key={`item-${event.id}`}
            />
        );
    }

    return (
        <Box ps="8px" {...boxProps} position="relative">
            <Box
                position="absolute"
                zIndex={0}
                left="4px"
                top="4px"
                h="100%"
                w="2px"
                borderLeftWidth="2px"
                borderLeftStyle="dashed"
                borderLeftColor={lineColor}
            ></Box>
            <Box position="relative" ps="100px">
                {renderItems}
            </Box>
        </Box>
    );
};

type TimelineDateMarkerProps = {
    date: Date;
    lineColor: string;
};

const TimelineDateMarker: React.FC<TimelineDateMarkerProps> = (props) => {
    const { date, lineColor } = props;
    return (
        <Box ml="-120px" mb={4}>
            <Box
                display="inline-block"
                bg={lineColor}
                borderRadius="full"
                px={4}
                py={2}
                fontSize="xs"
                fontWeight="extrabold"
            >
                <Selectable>{date.toLocaleDateString()}</Selectable>
            </Box>
        </Box>
    );
};

type TimelineItemProps = {
    event: TimelineEvent;
    lineColor: string;
};

const TimelineItem: React.FC<TimelineItemProps> = (props) => {
    const { event, lineColor } = props;
    return (
        <Box mb={4}>
            <Box
                position="absolute"
                left="-13px"
                bg="primary.500"
                borderRadius="full"
                borderWidth="2px"
                borderColor={lineColor}
                w="20px"
                h="20px"
                mt="3px"
            />
            <Box position="absolute" left="15px" fontSize="xs" mt="4px">
                <Selectable>
                    {event.when.toLocaleTimeString(undefined, {
                        hour12: false,
                    })}
                </Selectable>
            </Box>
            <Box>{event.content}</Box>
        </Box>
    );
};
