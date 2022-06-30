import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useIpcCall } from "../../hook/ipc";
import { ClusterEventsOverview } from "./ClusterEventsOverview";
import { ClusterInfoOverview } from "./ClusterInfoOverview";
import { ClusterNodesOverview } from "./ClusterNodesOverview";
import { ClusterPortForwardsOverview } from "./ClusterPortForwardsOverview";

export const ClusterOverview: React.FC<{}> = () => {
    const activeTab = useAppRoute(
        (route) => route.menuTab[route.menuItem ?? "cluster"] ?? "info"
    );
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const setActiveTab = useCallback(
        (menuTab: string) => {
            setAppRoute((route) => {
                return {
                    ...route,
                    menuTab: {
                        ...route.menuTab,
                        [route.menuItem ?? "cluster"]: menuTab,
                    },
                };
            });
        },
        [setAppRoute]
    );

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                const oldRoute = getAppRoute();
                if (oldRoute.menuItem) {
                    createWindow({
                        route: {
                            ...oldRoute,
                            menuTab: {
                                ...oldRoute.menuTab,
                                [oldRoute.menuItem]: id,
                            },
                        },
                    });
                }
            } else {
                setActiveTab(id);
            }
        },
        [createWindow, getAppRoute, setActiveTab]
    );

    const tabs = [
        { id: "info", title: "Info", content: <ClusterInfoOverview /> },
        { id: "events", title: "Events", content: <ClusterEventsOverview /> },
        { id: "nodes", title: "Nodes", content: <ClusterNodesOverview /> },
        {
            id: "port-forward",
            title: "Forwarding",
            content: <ClusterPortForwardsOverview />,
        },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={activeTab}
            onChangeSelection={onChangeTabSelection}
            isLazy="lazy-create"
        />
    );
};
