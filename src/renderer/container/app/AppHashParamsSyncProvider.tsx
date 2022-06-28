import React, { useEffect } from "react";
import { emptyAppRoute } from "../../../common/route/app-route";
import { useAppRouteHistoryStore } from "../../context/route";
import { getHashParams, setHashParams } from "../../util/location";

export const AppHashParamsSyncProvider: React.FC = ({ children }) => {
    const store = useAppRouteHistoryStore();

    useEffect(() => {
        const hashParams = getHashParams();
        if (hashParams?.route) {
            const appRoute = { ...emptyAppRoute };
            const route = hashParams.route as any;
            appRoute.context = route.context ?? null;
            appRoute.namespaces = route.namespaces ?? null;
            if (route.menuItem) {
                appRoute.menuItem = route.menuItem;
            }
            if (route.menuTab) {
                appRoute.menuTab = route.menuTab;
            }
            if (route.params) {
                appRoute.params = route.params;
            }
            if (route.activeEditor) {
                appRoute.activeEditor = route.activeEditor;
            }
            if ("isSidebarVisible" in route) {
                appRoute.isSidebarVisible = route.isSidebarVisible;
            }
            store.setCurrent(appRoute, true);
        }

        const listener = (history) => {
            const route = history.values[history.currentIndex];
            const hashParams = getHashParams();
            setHashParams({ ...hashParams, route });
        };
        store.subscribe(listener);
        return () => {
            store.unsubscribe(listener);
        };
    }, [store]);

    return <>{children}</>;
};
