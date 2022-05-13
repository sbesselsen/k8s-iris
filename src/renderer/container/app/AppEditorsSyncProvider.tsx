import React, { useEffect } from "react";
import { AppEditor } from "../../../common/route/app-route";
import { useAppEditorsStore } from "../../context/editors";
import { useAppRoute, useAppRouteSetter } from "../../context/route";

export const AppEditorsSyncProvider: React.FC<{}> = (props) => {
    const { children } = props;

    const appEditorsStore = useAppEditorsStore();
    const appRoute = useAppRoute();
    const setAppRoute = useAppRouteSetter();

    const activeEditor = appRoute.activeEditor;
    useEffect(() => {
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
    }, [activeEditor, appEditorsStore]);

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
        };
        appEditorsStore.subscribe(listener);
        return () => {
            appEditorsStore.unsubscribe(listener);
        };
    }, [appEditorsStore, setAppRoute]);

    return <>{children}</>;
};
