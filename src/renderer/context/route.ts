import { useMemo } from "react";
import { create } from "../util/state";

export type AppRoute = {
    context: string;
    namespaces: string[];
    overviewStyle: OverviewStyle;
};

export type OverviewStyle =
    | "cluster_info"
    | "cluster_nodes"
    | "applications"
    | "custom_objects";

const defaultAppRoute: AppRoute = {
    context: null,
    namespaces: [],
    overviewStyle: "cluster_info",
};

const hashString = window.location.hash;
if (hashString) {
    defaultAppRoute.context =
        JSON.parse(atob(hashString.slice(1))).context ?? null;
    defaultAppRoute.namespaces =
        JSON.parse(atob(hashString.slice(1))).namespaces ?? [];
}

const [useAppRouteStore, useAppRouteBase, rootAppRouteStore] =
    create(defaultAppRoute);
export const useAppRoute = useAppRouteBase;

rootAppRouteStore.subscribe((newRoute) => {
    // Change the window hash when the root app route changes, as a way to tell the main application what this window is about.
    window.location.hash = "#" + btoa(JSON.stringify(newRoute));
});

export type AppRouteActions = {
    selectContext: (context: string) => AppRoute;
    selectNamespaces: (namespaces: string[]) => AppRoute;
    selectOverviewStyle: (overviewStyle: OverviewStyle) => AppRoute;
};
export const useAppRouteActions = (): AppRouteActions => {
    const store = useAppRouteStore();

    return useMemo(
        () => ({
            selectContext: (context: string) =>
                store.set((route) => ({ ...route, context })),
            selectNamespaces: (namespaces: string[]) =>
                store.set((route) => ({ ...route, namespaces })),
            selectOverviewStyle: (overviewStyle: OverviewStyle) =>
                store.set((route) => ({ ...route, overviewStyle })),
        }),
        [store]
    );
};
