import { useMemo } from "react";
import {
    AppMenuItem,
    AppNamespacesSelection,
    AppRoute,
    emptyAppRoute,
} from "../../common/route/app-route";
import { getHashParams, setHashParams } from "../util/location";
import { create } from "../util/state";

const appRoute: AppRoute = { ...emptyAppRoute };

const hashParams = getHashParams();
if (hashParams?.route) {
    const route = hashParams.route as any;
    appRoute.context = route.context ?? null;
    appRoute.namespaces = route.namespaces ?? null;
    if (route.menuItem) {
        appRoute.menuItem = route.menuItem;
    }
}

const [useAppRouteStore, useAppRouteBase, rootAppRouteStore] = create(appRoute);
export const useAppRoute = useAppRouteBase;

rootAppRouteStore.subscribe((route) => {
    const hashParams = getHashParams();
    setHashParams({ ...hashParams, route });
});

export type AppRouteActions = {
    selectContext: (context: string) => AppRoute;
    selectNamespaces: (namespaces: AppNamespacesSelection) => AppRoute;
    selectMenuItem: (menuItem: AppMenuItem) => AppRoute;
};
export const useAppRouteActions = (): AppRouteActions => {
    const store = useAppRouteStore();

    return useMemo(
        () => ({
            selectContext: (context: string) =>
                store.set((route) => ({ ...route, context })),
            selectNamespaces: (namespaces: AppNamespacesSelection) =>
                store.set((route) => ({ ...route, namespaces })),
            selectMenuItem: (menuItem: AppMenuItem) =>
                store.set((route) => ({ ...route, menuItem })),
        }),
        [store]
    );
};
