import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useIpcCall } from "../../hook/ipc";
import {
    ResourceAllOverview,
    ResourceTypeOverview,
} from "./ResourceAllOverview";
import { ResourceWorkloadsOverview } from "./ResourceWorkloadsOverview";

const namespaceResourceType = {
    apiVersion: "v1",
    kind: "Namespace",
};

export const ResourcesOverview: React.FC<{}> = () => {
    const activeTab = useAppRoute(
        (route) => route.menuTab[route.menuItem ?? "resources"] ?? "workloads"
    );
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const setActiveTab = useCallback(
        (menuTab: string) => {
            setAppRoute((route) => {
                if (route.menuItem) {
                    return {
                        ...route,
                        menuTab: {
                            ...route.menuTab,
                            [route.menuItem ?? "resources"]: menuTab,
                        },
                    };
                }
                return route;
            });
        },
        [setAppRoute]
    );

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow = false) => {
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
        {
            id: "workloads",
            title: "Workloads",
            content: <ResourceWorkloadsOverview />,
        },
        {
            id: "namespaces",
            title: "Namespaces",
            content: (
                <ResourceTypeOverview resourceType={namespaceResourceType} />
            ),
        },
        { id: "all", title: "By type", content: <ResourceAllOverview /> },
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
