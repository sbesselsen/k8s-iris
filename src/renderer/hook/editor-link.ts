import { useCallback, useMemo } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { AppEditor } from "../../common/route/app-route";
import { resourceEditor, useAppEditorsStore } from "../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../context/route";
import { useIpcCall } from "./ipc";
import { useModifierKeyRef } from "./keyboard";

export function useEditorLink(resource: K8sObject | K8sObjectIdentifier): {
    openEditor: () => void;
} {
    const innerOpenEditor = useEditorOpener();

    const openEditor = useCallback(() => {
        innerOpenEditor(resourceEditor(resource));
    }, [innerOpenEditor, resource]);

    return useMemo(() => ({ openEditor }), [openEditor]);
}

export type EditorOpenOptions = {
    requestNewWindow?: boolean;
    requestBackground?: boolean;
};

export function useEditorOpener(): (
    editor: AppEditor,
    options?: EditorOpenOptions
) => void {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const altKeyRef = useModifierKeyRef("Alt");
    const metaKeyRef = useModifierKeyRef("Meta");

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const appEditorsStore = useAppEditorsStore();

    return useCallback(
        (editor: AppEditor, options: EditorOpenOptions = {}) => {
            const {
                requestNewWindow = metaKeyRef.current,
                requestBackground = altKeyRef.current,
            } = options;
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...getAppRoute(),
                        activeEditor: editor,
                        isSidebarVisible: false,
                    },
                });
            } else {
                if (requestBackground) {
                    // Option+click: open in background.
                    appEditorsStore.set((editors) => {
                        if (editors.find((e) => e.id === editor.id)) {
                            return editors;
                        }
                        return [...editors, editor];
                    });
                } else {
                    setAppRoute((route) => ({
                        ...route,
                        activeEditor: editor,
                    }));
                }
            }
        },
        [altKeyRef, createWindow, metaKeyRef, getAppRoute, setAppRoute]
    );
}
