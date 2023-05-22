import React, { MutableRefObject, useMemo, useRef } from "react";

import { ScrollBox, ScrollBoxProps } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import { Badge, Box, Spinner } from "@chakra-ui/react";
import { Selectable } from "../../component/main/Selectable";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { searchMatch } from "../../../common/util/search";
import { useAppSearch } from "../../context/search";
import { Timeline } from "../../component/main/Timeline";
import { ResourceEditorLink } from "../resources/ResourceEditorLink";

export type ClusterEventsOverviewProps = ScrollBoxProps;

export const ClusterEventsOverview: React.FC<ClusterEventsOverviewProps> = (
    props
) => {
    const namespaces = useK8sNamespaces();

    const scrollBoxRef = useRef<HTMLDivElement>();

    const [isLoadingEvents, events] = useK8sListWatch(
        {
            apiVersion: "events.k8s.io/v1",
            kind: "Event",
            ...(namespaces.mode === "all"
                ? {}
                : { namespaces: namespaces.selected }),
        },
        {
            updateCoalesceInterval: 1000,
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
                        selectionContainerRef={
                            scrollBoxRef as MutableRefObject<HTMLElement>
                        }
                    />
                );
                return { when, content, id };
            })
            .sort((x, y) => y.when.getTime() - x.when.getTime())
            .slice(0, 1000);
    }, [events, query, scrollBoxRef]);

    return (
        <ScrollBox
            pb={10}
            w="100%"
            ref={scrollBoxRef as MutableRefObject<HTMLDivElement>}
            {...props}
        >
            {isLoadingEvents && <Spinner />}
            {!isLoadingEvents && timelineEvents.length === 0 && (
                <Box fontSize="sm" px={2} textColor="gray">
                    No events.
                </Box>
            )}
            {!isLoadingEvents && timelineEvents.length > 0 && (
                <Timeline sort="none" pe={6} events={timelineEvents} />
            )}
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
            <Selectable
                containerRef={selectionContainerRef}
                fontSize="sm"
                lineHeight={1.5}
            >
                {event.type !== "Normal" && (
                    <Badge
                        colorScheme={event.type === "Warning" ? "red" : "gray"}
                        verticalAlign="baseline"
                    >
                        {event.type}
                    </Badge>
                )}{" "}
                {event.deprecatedCount > 1 ? (
                    <Badge textTransform="none" verticalAlign="baseline">
                        {event.deprecatedCount}x
                    </Badge>
                ) : (
                    ""
                )}{" "}
                {event.note}
            </Selectable>
            {event?.regarding && (
                <ResourceEditorLink
                    fontSize="xs"
                    fontWeight="bold"
                    mt={1}
                    display="flex"
                    editorResource={event.regarding}
                >
                    {event?.regarding?.kind}:{" "}
                    {event?.metadata?.namespace &&
                        `${event.metadata.namespace}/`}
                    {event?.regarding?.name}
                </ResourceEditorLink>
            )}
        </Box>
    );
});
