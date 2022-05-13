import { Link, LinkProps } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import {
    appEditorForK8sObject,
    appEditorForK8sObjectIdentifier,
    useAppEditorsStore,
} from "../../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";

export type ResourceEditorLinkProps = LinkProps & {
    editorResource: K8sObject | K8sObjectIdentifier;
};

export const ResourceEditorLink: React.FC<ResourceEditorLinkProps> = (
    props
) => {
    const { editorResource, ...linkProps } = props;

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const altKeyRef = useModifierKeyRef("Alt");
    const metaKeyRef = useModifierKeyRef("Meta");

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const appEditorsStore = useAppEditorsStore();

    const onClick = useCallback(() => {
        const editor = isK8sObject(editorResource)
            ? appEditorForK8sObject(editorResource)
            : appEditorForK8sObjectIdentifier(editorResource);
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
        editorResource,
        metaKeyRef,
        getAppRoute,
        setAppRoute,
    ]);

    return <Link onClick={onClick} {...linkProps} />;
};

function isK8sObject(
    resource: K8sObject | K8sObjectIdentifier
): resource is K8sObject {
    return "metadata" in (resource as any);
}
