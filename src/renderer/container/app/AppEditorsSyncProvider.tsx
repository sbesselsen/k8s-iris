import React, { PropsWithChildren, useCallback, useEffect } from "react";
import { AppEditor } from "../../../common/route/app-route";
import { useAppEditorsStore } from "../../context/editors";
import {
    useAppRouteGetter,
    useAppRouteHistoryStore,
    useAppRouteSetter,
} from "../../context/route";

export const AppEditorsSyncProvider: React.FC<PropsWithChildren> = (props) => {
    const { children } = props;

    const appEditorsStore = useAppEditorsStore();
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const historyStore = useAppRouteHistoryStore();

    const openEditorFromActiveEditor = useCallback(
        (activeEditor: AppEditor | null) => {
            if (!activeEditor) {
                return;
            }
            appEditorsStore.set((editors) => {
                if (!editors.find((editor) => editor.id === activeEditor.id)) {
                    console.log("Editor was opened", activeEditor.id);
                    return [...editors, activeEditor];
                }
                return editors;
            });
        },
        [appEditorsStore]
    );

    useEffect(() => {
        openEditorFromActiveEditor(getAppRoute().activeEditor);

        let context = getAppRoute().context;

        historyStore.subscribe((history) => {
            const newRoute = history.values[history.currentIndex];

            if (newRoute.context !== context) {
                // If the context changes, close all editors except the potential active editor in the new route.
                context = newRoute.context;
                appEditorsStore.set(
                    newRoute.activeEditor ? [newRoute.activeEditor] : []
                );
            } else {
                // If the active editor changes, update the editors state.
                openEditorFromActiveEditor(newRoute.activeEditor ?? null);
            }
        });
    }, [appEditorsStore, getAppRoute, historyStore]);

    useEffect(() => {
        let oldValue = appEditorsStore.get();
        const listener = (newValue: AppEditor[]) => {
            const newIds = new Set(newValue.map((editor) => editor.id));
            const removedIds = new Set(
                oldValue
                    .filter((editor) => !newIds.has(editor.id))
                    .map((editor) => editor.id)
            );
            if (removedIds.size > 0) {
                console.log("Editors were closed", removedIds);
                setAppRoute((route) => {
                    if (
                        route.activeEditor &&
                        removedIds.has(route.activeEditor.id)
                    ) {
                        // The active editor was closed.
                        return { ...route, activeEditor: null };
                    }
                    return route;
                });
            }
            oldValue = newValue;
        };
        appEditorsStore.subscribe(listener);
        return () => {
            appEditorsStore.unsubscribe(listener);
        };
    }, [appEditorsStore, setAppRoute]);

    return <>{children}</>;
};
