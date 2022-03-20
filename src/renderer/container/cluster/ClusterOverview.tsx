import { Box, Button } from "@chakra-ui/react";
import React, { useCallback, useEffect } from "react";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppParam } from "../../context/param";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { useIpcCall } from "../../hook/ipc";

export const ClusterOverview: React.FC<{}> = () => {
    const activeTab = useAppRoute((route) => route.subMenuItem ?? "info");
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
        { id: "info", title: "Info", content: <TestContent /> },
        { id: "nodes", title: "Nodes", content: <TestContent /> },
        { id: "cloud", title: "Cloud", content: <TestContent /> },
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

const TestContent: React.FC = () => {
    useEffect(() => {
        console.log("render");
    }, []);
    const [count, setCount] = useAppParam("count", 1);
    const onClick = useCallback(() => {
        setCount((c) => c + 1);
    }, [setCount]);

    return (
        <Box p={6}>
            <Button onClick={onClick}>{count}</Button>
        </Box>
    );
};
