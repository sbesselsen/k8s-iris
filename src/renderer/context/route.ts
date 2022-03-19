import { useMemo } from "react";
import {
    AppNamespacesSelection,
    AppRoute,
    emptyAppRoute,
} from "../../common/route/app-route";
import { createStoreHooks, StoreUpdate } from "../util/state";
import {
    createHistoryStore,
    HistoryControls,
    HistoryInfo,
    useCurrentValue,
    useCurrentValueGetter,
    useHistoryControls,
    useHistoryInfo,
} from "../util/state-history";

const rootAppRouteHistoryStore = createHistoryStore(emptyAppRoute);
const {
    useStore: useAppRouteHistoryStore,
    useStoreValue: useAppRouteHistoryValue,
} = createStoreHooks(rootAppRouteHistoryStore);

export { useAppRouteHistoryStore, useAppRouteHistoryValue };

export const useAppRoute = useCurrentValue(useAppRouteHistoryValue);

export const useAppRouteGetter = useCurrentValueGetter(useAppRouteHistoryStore);

export type AppRouteActions = {
    selectContext: (context: string) => AppRoute;
    selectNamespaces: (namespaces: AppNamespacesSelection) => AppRoute;
    selectMenuItem: (menuItem: string) => AppRoute;
    selectContentRoute: (contentRoute: any | undefined) => AppRoute;
    setAppRoute: (
        newRoute: (oldRoute: AppRoute) => AppRoute,
        replace?: boolean
    ) => AppRoute;
};
export const useAppRouteActions = (): AppRouteActions => {
    const store = useAppRouteHistoryStore();

    const setAppRoute = (newRoute: StoreUpdate<AppRoute>, replace = false) =>
        store.setCurrent(newRoute, replace);

    return useMemo(() => {
        return {
            selectContext: (context: string) =>
                setAppRoute((route) => ({ ...route, context })),
            selectNamespaces: (namespaces: AppNamespacesSelection) => {
                const oldRoute = store.getCurrent();
                const createHistoryItem =
                    namespaces.mode !== oldRoute.namespaces.mode ||
                    (namespaces.mode === "selected" &&
                        namespaces.selected.length === 1);
                return setAppRoute(
                    () => ({ ...oldRoute, namespaces }),
                    !createHistoryItem
                );
            },
            selectMenuItem: (menuItem: string) =>
                setAppRoute((route) => ({
                    ...route,
                    menuItem,
                })),
            selectContentRoute: (contentRoute: any | undefined) =>
                setAppRoute((route) => ({
                    ...route,
                    contentRoute,
                })),
            setAppRoute,
        };
    }, [store]);
};

export const useAppRouteHistory = (): HistoryInfo &
    HistoryControls<AppRoute> => {
    const { canGoBack, canGoForward } = useHistoryInfo(useAppRouteHistoryValue);
    const { goBack, goForward } = useHistoryControls(useAppRouteHistoryStore);

    return {
        canGoBack,
        canGoForward,
        goBack,
        goForward,
    };
};

// TODO: local routes
