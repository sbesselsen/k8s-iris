import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";
import { ClusterEventsOverview } from "./ClusterEventsOverview";
import { ClusterInfoOverview } from "./ClusterInfoOverview";
import { ClusterNodesOverview } from "./ClusterNodesOverview";

export const ClusterOverview: React.FC<{}> = () => {
    const [activeTab, setActiveTab] = useAppParam("tab", "info");

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
        { id: "info", title: "Info", content: <ClusterInfoOverview /> },
        { id: "events", title: "Events", content: <ClusterEventsOverview /> },
        { id: "nodes", title: "Nodes", content: <ClusterNodesOverview /> },
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
