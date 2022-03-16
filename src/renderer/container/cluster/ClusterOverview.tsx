import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import {
    useAppRoute,
    useAppRouteActions,
    useAppRouteGetter,
} from "../../context/route";
import { useIpcCall } from "../../hook/ipc";

type ClusterContentRoute = {
    item: string;
};

const defaultClusterContentRoute: ClusterContentRoute = {
    item: "info",
};

export const ClusterOverview: React.FC<{}> = () => {
    const getAppRoute = useAppRouteGetter();
    const { selectContentRoute } = useAppRouteActions();

    const contentRoute = useAppRoute(
        (route) => route.contentRoute ?? defaultClusterContentRoute
    );

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...getAppRoute(),
                        contentRoute: { item: id },
                    },
                });
            } else {
                selectContentRoute({ item: id });
            }
        },
        [createWindow, getAppRoute, selectContentRoute]
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
