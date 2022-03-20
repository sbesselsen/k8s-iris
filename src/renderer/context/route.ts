import { useCallback } from "react";
import { AppRoute, emptyAppRoute } from "../../common/route/app-route";
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

export type AppRouteSetter = (
    newRoute: (oldRoute: AppRoute) => AppRoute,
    replace?: boolean
) => AppRoute;

export const useAppRouteSetter = (): AppRouteSetter => {
    const store = useAppRouteHistoryStore();
    return useCallback(
        (newRoute: StoreUpdate<AppRoute>, replace = false) => {
            return store.setCurrent(newRoute, replace);
        },
        [store]
    );
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
