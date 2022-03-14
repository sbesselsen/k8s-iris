import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppRoute, useAppRouteActions } from "../../context/route";
import { useIpcCall } from "../../hook/ipc";

type ClusterContentRoute = {
    item: string;
};

const defaultClusterContentRoute: ClusterContentRoute = {
    item: "info",
};

export const ClusterOverview: React.FC<{}> = () => {
    const appRoute = useAppRoute();
    const { contentRoute: baseContentRoute } = appRoute;
    const { selectContentRoute } = useAppRouteActions();

    const contentRoute = baseContentRoute ?? defaultClusterContentRoute;

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...appRoute,
                        contentRoute: { item: id },
                    },
                });
            } else {
                selectContentRoute({ item: id });
            }
        },
        [appRoute, createWindow, selectContentRoute]
    );

    const tabs = [
        { id: "info", title: "Info", content: <Box /> },
        { id: "nodes", title: "Nodes", content: <Box /> },
        { id: "cloud", title: "Cloud", content: <Box /> },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={contentRoute.item}
            onChangeSelection={onChangeTabSelection}
        />
    );
};
