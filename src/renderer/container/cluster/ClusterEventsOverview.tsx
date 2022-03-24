import React, { MutableRefObject, useMemo, useRef } from "react";

import { ScrollBox } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import { Badge, Box, Text } from "@chakra-ui/react";
import { Selectable } from "../../component/main/Selectable";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { searchMatch } from "../../../common/util/search";
import { useAppSearch } from "../../context/search";
import { Timeline } from "../../component/main/Timeline";

export const ClusterEventsOverview: React.FC = () => {
    const namespaces = useK8sNamespaces();

    const scrollBoxRef = useRef<HTMLDivElement>();

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

    const { query } = useAppSearch();

    const timelineEvents = useMemo(() => {
        let filteredItems = events?.items ?? [];
        if (query) {
            filteredItems = filteredItems.filter((event: any) => {
                return searchMatch(
                    query,
                    [
                        event?.note,
                        event?.metadata?.namespace,
                        event?.regarding?.kind,
                        event?.regarding?.name,
                        event?.metadata?.namespace,
                    ]
                        .filter((x) => x)
                        .join(" ")
                );
            });
        }
        return filteredItems
            .map((event: any) => {
                const id = event.metadata.uid;
                const when = new Date(
                    event.deprecatedLastTimestamp ??
                        event.metadata.creationTimestamp
                );
                const content = (
                    <EventContent
                        event={event}
                        selectionContainerRef={scrollBoxRef}
                    />
                );
                return { when, content, id };
            })
            .sort((x, y) => y.when.getTime() - x.when.getTime())
            .slice(0, 100);
    }, [events, query, scrollBoxRef]);

    return (
        <ScrollBox px={4} pt={3} pb={10} w="100%" ref={scrollBoxRef}>
            <Timeline sort="none" pe={6} events={timelineEvents} />
        </ScrollBox>
    );
};

const EventContent: React.FC<{
    event: any;
    selectionContainerRef: MutableRefObject<HTMLElement>;
}> = React.memo((props) => {
    const { event, selectionContainerRef } = props;

    return (
        <Box maxWidth="1000px">
            <Selectable containerRef={selectionContainerRef} lineHeight="1.3">
                {event.type !== "Normal" && (
                    <Badge
                        me={2}
                        colorScheme={event.type === "Warning" ? "red" : "gray"}
                    >
                        {event.type}
                    </Badge>
                )}
                {event.deprecatedCount > 1 ? (
                    <Badge textTransform="none">{event.deprecatedCount}x</Badge>
                ) : (
                    ""
                )}{" "}
                {event.note}
            </Selectable>
            <Text fontSize="xs" fontWeight="bold">
                {event?.regarding?.kind}:{" "}
                {event?.metadata?.namespace && `${event.metadata.namespace}/`}
                {event?.regarding?.name}
            </Text>
        </Box>
    );
});
