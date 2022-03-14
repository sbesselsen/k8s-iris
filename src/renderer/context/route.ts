import { useMemo } from "react";
import {
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
    if (route.contentRoute) {
        appRoute.contentRoute = route.contentRoute;
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
    selectMenuItem: (menuItem: string) => AppRoute;
    selectContentRoute: (contentRoute: any | undefined) => AppRoute;
    setAppRoute: (
        newRoute: AppRoute | ((oldRoute: AppRoute) => AppRoute)
    ) => AppRoute;
};
export const useAppRouteActions = (): AppRouteActions => {
    const store = useAppRouteStore();

    return useMemo(
        () => ({
            selectContext: (context: string) =>
                store.set((route) => ({ ...route, context })),
            selectNamespaces: (namespaces: AppNamespacesSelection) =>
                store.set((route) => ({ ...route, namespaces })),
            selectMenuItem: (menuItem: string) =>
                store.set(({ contentRoute, ...route }) => ({
                    ...route,
                    menuItem,
                })),
            selectContentRoute: (contentRoute: any | undefined) =>
                store.set((route) => ({ ...route, contentRoute })),
            setAppRoute: (route) => store.set(route),
        }),
        [store]
    );
};
