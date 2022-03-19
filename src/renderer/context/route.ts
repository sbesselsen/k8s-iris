import { useMemo } from "react";
import {
    AppNamespacesSelection,
    AppRoute,
    emptyAppRoute,
} from "../../common/route/app-route";
import { getHashParams, setHashParams } from "../util/location";
import {
    createStoreHooks,
    StoreUpdate,
    UseStoreValue,
    UseStoreValueGetter,
} from "../util/state";
import {
    createHistoryStore,
    HistoryControls,
    HistoryInfo,
    useHistoryControls,
    useHistoryInfo,
} from "../util/state-history";

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

const rootAppRouteHistoryStore = createHistoryStore(appRoute);
const {
    useStore: useAppRouteHistoryStore,
    useStoreValue: useAppRouteHistoryValue,
} = createStoreHooks(rootAppRouteHistoryStore);

rootAppRouteHistoryStore.subscribe((history) => {
    const route = history.values[history.currentIndex];
    const hashParams = getHashParams();
    setHashParams({ ...hashParams, route });
});

export const useAppRoute: UseStoreValue<AppRoute> = (
    selector = undefined,
    deps = []
) => {
    return useAppRouteHistoryValue((history) => {
        const route = history.values[history.currentIndex];
        return selector ? selector(route) : route;
    }, deps);
};

export const useAppRouteGetter: UseStoreValueGetter<AppRoute> = () => {
    const store = useAppRouteHistoryStore();
    return () => {
        const history = store.get();
        return history.values[history.currentIndex];
    };
};

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
