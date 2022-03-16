import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppRoute, useAppRouteActions } from "../../context/route";
import { useIpcCall } from "../../hook/ipc";

type ResourcesContentRoute = {
    item: string;
};

const defaultResourcesContentRoute: ResourcesContentRoute = {
    item: "workloads",
};

export const ResourcesOverview: React.FC<{}> = () => {
    const appRoute = useAppRoute();
    const { selectContentRoute } = useAppRouteActions();

    const contentRoute = useAppRoute(
        (route) => route.contentRoute ?? defaultResourcesContentRoute
    );

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
        { id: "workloads", title: "Workloads", content: <Box /> },
        { id: "other", title: "Other", content: <Box /> },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={contentRoute.item}
            onChangeSelection={onChangeTabSelection}
        />
    );
};
