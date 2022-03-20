import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useIpcCall } from "../../hook/ipc";

export const ResourcesOverview: React.FC<{}> = () => {
    const activeTab = useAppRoute((route) => route.subMenuItem ?? "workloads");
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const setActiveTab = useCallback(
        (tab: string) => {
            setAppRoute((route) => ({ ...route, subMenuItem: tab }));
        },
        [setAppRoute]
    );

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: { ...getAppRoute(), subMenuItem: id },
                });
            } else {
                setActiveTab(id);
            }
        },
        [createWindow, getAppRoute, setActiveTab]
    );

    const tabs = [
        { id: "workloads", title: "Workloads", content: <Box /> },
        { id: "other", title: "Other", content: <Box /> },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={activeTab}
            onChangeSelection={onChangeTabSelection}
            isLazy
        />
    );
};
