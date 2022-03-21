import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";

export const ResourcesOverview: React.FC<{}> = () => {
    const [activeTab, setActiveTab] = useAppParam("tab", "workloads");

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: setActiveTab.asRoute(id),
                });
            } else {
                setActiveTab(id);
            }
        },
        [createWindow, setActiveTab]
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
