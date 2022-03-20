import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppRouteGetter } from "../../context/route";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";

export const ClusterOverview: React.FC<{}> = () => {
    const getAppRoute = useAppRouteGetter();

    const [activeTab, setActiveTab] = useAppParam("tab", "info");

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...getAppRoute(),
                    },
                });
            } else {
                setActiveTab(id);
            }
        },
        [createWindow, getAppRoute, setActiveTab]
    );

    const tabs = [
        { id: "info", title: "Info", content: <Box /> },
        { id: "nodes", title: "Nodes", content: <Box /> },
        { id: "cloud", title: "Cloud", content: <Box /> },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={activeTab}
            onChangeSelection={onChangeTabSelection}
        />
    );
};
