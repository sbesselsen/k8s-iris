import React, { useEffect } from "react";
import { emptyAppRoute } from "../../../common/route/app-route";
import { useAppRouteHistoryStore } from "../../context/route";
import { getHashParams, setHashParams } from "../../util/location";

export const AppHashParamsSync: React.FC = () => {
    const store = useAppRouteHistoryStore();

    useEffect(() => {
        const hashParams = getHashParams();
        if (hashParams?.route) {
            const appRoute = { ...emptyAppRoute };
            const route = hashParams.route as any;
            appRoute.context = route.context ?? null;
            appRoute.namespaces = route.namespaces ?? null;
            if (route.params) {
                appRoute.params = route.params;
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

    return null;
};
