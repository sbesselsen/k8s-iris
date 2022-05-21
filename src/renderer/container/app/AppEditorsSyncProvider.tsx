import React, { useCallback, useEffect } from "react";
import { AppEditor } from "../../../common/route/app-route";
import { useAppEditorsStore } from "../../context/editors";
import {
    useAppRouteGetter,
    useAppRouteHistoryStore,
    useAppRouteSetter,
} from "../../context/route";

export const AppEditorsSyncProvider: React.FC<{}> = (props) => {
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
        historyStore.subscribe((history) => {
            openEditorFromActiveEditor(
                history.values[history.currentIndex]?.activeEditor ?? null
            );
        });
    }, [getAppRoute, historyStore]);

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
