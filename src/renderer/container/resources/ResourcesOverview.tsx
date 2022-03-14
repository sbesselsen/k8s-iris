import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppRoute, useAppRouteActions } from "../../context/route";
import { useIpcCall } from "../../hook/ipc";

type ResourcesContentRoute = {
    item: string;
};

const defaultResourcesContentRoute: ResourcesContentRoute = {
    item: "info",
};

export const ResourcesOverview: React.FC<{}> = (props) => {
    const appRoute = useAppRoute();
    const { contentRoute: baseContentRoute } = appRoute;
    const { selectContentRoute } = useAppRouteActions();

    const contentRoute = baseContentRoute ?? defaultResourcesContentRoute;

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
        { id: "info", title: "Info", content: <strong>Aap</strong> },
        {
            id: "nodes",
            title: "Nodes",
            content: <Box>test</Box>,
        },
        {
            id: "cloud",
            title: "Cloud",
            content: <Box>bla</Box>,
        },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={contentRoute.item}
            onChangeSelection={onChangeTabSelection}
        />
    );
};
