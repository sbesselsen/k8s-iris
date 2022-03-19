import { useCallback, useMemo } from "react";
import {
    AppNamespacesSelection,
    AppRoute,
    emptyAppRoute,
} from "../../common/route/app-route";
import { getHashParams, setHashParams } from "../util/location";
import { create, UseStoreValue } from "../util/state";

type AppRouteHistory = {
    routes: AppRoute[];
    currentIndex: number;
    size: number;
};

const historyMaxSize = 100;
const historyMaxOverflow = 10;

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

const {
    useStore: useAppRouteHistoryStore,
    useStoreValue: useAppRouteHistoryValue,
    rootStore: rootAppRouteHistoryStore,
} = create({
    routes: [appRoute],
    currentIndex: 0,
    size: 1,
} as AppRouteHistory);

export const useAppRoute: UseStoreValue<AppRoute> = (
    selector?: (data: AppRoute) => any
) => {
    return useAppRouteHistoryValue(
        selector
            ? (history) => selector(history.routes[history.currentIndex])
            : (history) => history.routes[history.currentIndex]
    );
};

export const useAppRouteGetter = (): (() => AppRoute) => {
    const store = useAppRouteHistoryStore();
    return useCallback(() => {
        const history = store.get();
        return history.routes[history.currentIndex];
    }, [store]);
};

rootAppRouteHistoryStore.subscribe((history) => {
    const route = history.routes[history.currentIndex];
    const hashParams = getHashParams();
    setHashParams({ ...hashParams, route });
});

export type AppRouteActions = {
    selectContext: (context: string) => AppRoute;
    selectNamespaces: (namespaces: AppNamespacesSelection) => AppRoute;
    selectMenuItem: (menuItem: string) => AppRoute;
    selectContentRoute: (contentRoute: any | undefined) => AppRoute;
    setAppRoute: (
        newRoute: AppRoute | ((oldRoute: AppRoute) => AppRoute),
        createHistoryItem?: boolean
    ) => AppRoute;
};
export const useAppRouteActions = (): AppRouteActions => {
    const store = useAppRouteHistoryStore();

    return useMemo(() => {
        const setRoute = (
            newRoute: AppRoute | ((oldRoute: AppRoute) => AppRoute),
            createHistoryItem: boolean = true
        ): AppRoute => {
            const newHistory = store.set((history) => {
                const newHistory = { ...history, routes: [...history.routes] };
                const currentRoute = history.routes[history.currentIndex];
                const route =
                    typeof newRoute === "function"
                        ? newRoute(currentRoute)
                        : newRoute;
                if (createHistoryItem) {
                    const newIndex = newHistory.currentIndex + 1;
                    newHistory.routes[newIndex] = route;
                    newHistory.currentIndex = newIndex;
                    newHistory.size = newIndex + 1;
                    if (
                        newHistory.size >=
                        historyMaxSize + historyMaxOverflow
                    ) {
                        // Clean up history buffer so it does not grow unchecked.
                        // The right way to do this is probably with a ringbuffer or whatever,
                        // but I can't figure it out.
                        const numRoutesToDrop =
                            newHistory.routes.length - historyMaxSize;
                        newHistory.routes =
                            newHistory.routes.slice(numRoutesToDrop);
                        newHistory.currentIndex -= numRoutesToDrop;
                        newHistory.size -= numRoutesToDrop;
                    }
                } else {
                    newHistory.routes[newHistory.currentIndex] = route;
                }
                return newHistory;
            });
            return newHistory.routes[newHistory.currentIndex];
        };
        return {
            selectContext: (context: string) =>
                setRoute((route) => ({ ...route, context })),
            selectNamespaces: (namespaces: AppNamespacesSelection) => {
                const oldHistory = store.get();
                const oldRoute = oldHistory.routes[oldHistory.currentIndex];
                return setRoute(
                    (route) => ({ ...route, namespaces }),
                    namespaces.mode !== oldRoute.namespaces.mode ||
                        (namespaces.mode === "selected" &&
                            namespaces.selected.length <= 1)
                );
            },
            selectMenuItem: (menuItem: string) =>
                setRoute(({ contentRoute, ...route }) => ({
                    ...route,
                    menuItem,
                })),
            selectContentRoute: (
                contentRoute: any | undefined,
                createHistoryItem: boolean = true
            ) =>
                setRoute(
                    (route) => ({ ...route, contentRoute }),
                    createHistoryItem
                ),
            setAppRoute: (route) => setRoute(route),
        };
    }, [store]);
};

export type AppRouteHistoryHook = {
    canGoBack: boolean;
    canGoForward: boolean;
    goBack: () => void;
    goForward: () => void;
};

export const useAppRouteHistory = (): AppRouteHistoryHook => {
    const history = useAppRouteHistoryValue();
    const historyStore = useAppRouteHistoryStore();

    return useMemo(() => {
        return {
            canGoBack: history.currentIndex > 0,
            canGoForward: history.currentIndex < history.size - 1,
            goBack() {
                if (history.currentIndex > 0) {
                    historyStore.set((history) => ({
                        ...history,
                        currentIndex: history.currentIndex - 1,
                    }));
                }
            },
            goForward() {
                if (history.currentIndex < history.size - 1) {
                    historyStore.set((history) => ({
                        ...history,
                        currentIndex: history.currentIndex + 1,
                    }));
                }
            },
        };
    }, [history, historyStore]);
};
