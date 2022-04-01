import { K8sObject } from "../../common/k8s/client";
import { AppEditor, AppEditors, AppRoute } from "../../common/route/app-route";
import { StoreUpdate, UseStoreValue } from "../util/state";
import { useAppRoute, useAppRouteGetter, useAppRouteSetter } from "./route";

export type AppEditorsAction<T> = ((
    newValue: StoreUpdate<T>,
    replace?: boolean
) => void) & {
    asRoute: (newValue: StoreUpdate<T>, fromRoute?: AppRoute) => AppRoute;
};

export type AppEditorsSetter = AppEditorsAction<AppEditors>;

export const useAppEditors: UseStoreValue<AppEditors> = (
    selector = undefined,
    deps = []
) => {
    return useAppRoute(
        (route) => (selector ? selector(route.editors) : route.editors),
        deps
    );
};

export function useAppEditorsGetter(): () => AppEditors {
    const routeGetter = useAppRouteGetter();
    return () => routeGetter().editors;
}

export function useAppEditorsSetter(): AppEditorsAction<AppEditors> {
    const routeSetter = useAppRouteSetter();
    const routeGetter = useAppRouteGetter();

    function asRoute(
        newValue: StoreUpdate<AppEditors>,
        fromRoute?: AppRoute
    ): AppRoute {
        const oldRoute = fromRoute ?? routeGetter();
        const newEditors =
            typeof newValue === "function"
                ? newValue(oldRoute.editors)
                : newValue;
        if (oldRoute.editors === newEditors) {
            return oldRoute;
        }
        return {
            ...oldRoute,
            editors: newEditors,
        };
    }

    function setRoute(
        newValue: StoreUpdate<AppEditors>,
        replace: boolean = false
    ) {
        return routeSetter((route) => asRoute(newValue, route), replace)
            .editors;
    }
    setRoute.asRoute = asRoute;
    return setRoute;
}

export function useActiveEditor(): AppEditor | undefined {
    return useAppEditors((editors) =>
        editors.selected
            ? editors.items.find((editor) => editor.id === editors.selected)
            : undefined
    );
}

function useAppEditorAction<T>(
    updater: (newValue: StoreUpdate<T>, editors: AppEditors) => AppEditors
): AppEditorsAction<T> {
    const editorsSetter = useAppEditorsSetter();

    function asRoute(newValue: StoreUpdate<T>, fromRoute?: AppRoute): AppRoute {
        return editorsSetter.asRoute(
            (editors) => updater(newValue, editors),
            fromRoute
        );
    }

    function setRoute(newValue: StoreUpdate<T>, replace: boolean = false) {
        return editorsSetter((editors) => updater(newValue, editors), replace);
    }
    setRoute.asRoute = asRoute;
    return setRoute;
}

export function useAppEditorSelector(): AppEditorsAction<string | undefined> {
    return useAppEditorAction(
        (newValue: StoreUpdate<string | undefined>, editors: AppEditors) => {
            const newSelected =
                typeof newValue === "function"
                    ? newValue(editors.selected)
                    : newValue;
            if (editors.selected !== newSelected) {
                return { ...editors, selected: newSelected };
            }
            return editors;
        }
    );
}

export function useAppEditorCloser(): AppEditorsAction<string[] | string> {
    return useAppEditorAction(
        (idsToClose: StoreUpdate<string[] | string>, editors: AppEditors) => {
            const idsToCloseValue =
                typeof idsToClose === "function" ? idsToClose([]) : idsToClose;
            const idsToCloseArray = Array.isArray(idsToCloseValue)
                ? idsToCloseValue
                : [idsToCloseValue];
            return {
                ...editors,
                items: editors.items?.filter(
                    (e) => !idsToCloseArray.includes(e.id)
                ),
            };
        }
    );
}

export function useAppEditorUpdater(): AppEditorsAction<
    AppEditor & { selected?: boolean }
> {
    return useAppEditorAction(
        (
            newValue: StoreUpdate<AppEditor & { selected?: boolean }>,
            editors: AppEditors
        ) => {
            const { selected = true, ...newEditor } =
                typeof newValue === "function" ? newValue(undefined) : newValue;
            const existingEditor = editors.items?.find(
                (e) => e.id === newEditor.id
            );
            let newEditors = editors;
            if (existingEditor) {
                if (existingEditor !== newEditor) {
                    newEditors = {
                        ...editors,
                        items: editors.items?.map((e) =>
                            e.id === newEditor.id ? newEditor : e
                        ),
                    };
                }
            } else {
                newEditors = {
                    ...editors,
                    items: [...(editors.items ?? []), newEditor],
                };
            }
            const currentSelected = editors.selected === newEditor.id;
            if (selected !== currentSelected) {
                newEditors = {
                    ...newEditors,
                    selected: currentSelected ? undefined : newEditor.id,
                };
            }
            return newEditors;
        }
    );
}

export function appEditorForK8sObject(resource: K8sObject): AppEditor {
    return {
        type: "resource",
        id: `${resource.apiVersion}:${resource.kind}:${resource.metadata.namespace}:${resource.metadata.name}`,
        apiVersion: resource.apiVersion,
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace,
    };
}
