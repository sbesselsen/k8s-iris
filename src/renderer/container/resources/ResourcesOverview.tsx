import { Box } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppParam } from "../../context/param";
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
