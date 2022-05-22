import { useCallback, useMemo } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import {
    appEditorForK8sObject,
    appEditorForK8sObjectIdentifier,
    useAppEditorsStore,
} from "../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../context/route";
import { useIpcCall } from "./ipc";
import { useModifierKeyRef } from "./keyboard";

export function useEditorLink(resource: K8sObject | K8sObjectIdentifier): {
    openEditor: () => void;
} {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const altKeyRef = useModifierKeyRef("Alt");
    const metaKeyRef = useModifierKeyRef("Meta");

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const appEditorsStore = useAppEditorsStore();

    const openEditor = useCallback(() => {
        const editor = isK8sObject(resource)
            ? appEditorForK8sObject(resource)
            : appEditorForK8sObjectIdentifier(resource);
        if (metaKeyRef.current) {
            createWindow({
                route: {
                    ...getAppRoute(),
                    activeEditor: editor,
                },
            });
        } else {
            if (altKeyRef.current) {
                // Option+click: open in background.
                appEditorsStore.set((editors) => {
                    if (editors.find((e) => e.id === editor.id)) {
                        return editors;
                    }
                    return [...editors, editor];
                });
            } else {
                setAppRoute((route) => ({ ...route, activeEditor: editor }));
            }
        }
    }, [
        altKeyRef,
        createWindow,
        resource,
        metaKeyRef,
        getAppRoute,
        setAppRoute,
    ]);

    return useMemo(() => ({ openEditor }), [openEditor]);
}

function isK8sObject(
    resource: K8sObject | K8sObjectIdentifier
): resource is K8sObject {
    return "metadata" in (resource as any);
}
