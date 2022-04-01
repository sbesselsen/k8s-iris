import { Link, LinkProps } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import {
    appEditorForK8sObject,
    appEditorForK8sObjectIdentifier,
    useAppEditorsSetter,
    useAppEditorUpdater,
} from "../../context/editors";
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

    const setAppEditors = useAppEditorsSetter();
    const updateAppEditor = useAppEditorUpdater();

    const onClick = useCallback(() => {
        const editor = isK8sObject(editorResource)
            ? appEditorForK8sObject(editorResource)
            : appEditorForK8sObjectIdentifier(editorResource);
        if (metaKeyRef.current) {
            createWindow({
                route: setAppEditors.asRoute((editors) => ({
                    ...editors,
                    selected: editor.id,
                    items: [editor],
                })),
            });
        } else {
            updateAppEditor({
                ...editor,
                selected: !altKeyRef.current,
            });
        }
    }, [
        altKeyRef,
        createWindow,
        editorResource,
        metaKeyRef,
        setAppEditors,
        updateAppEditor,
    ]);

    return <Link onClick={onClick} {...linkProps} />;
};

function isK8sObject(
    resource: K8sObject | K8sObjectIdentifier
): resource is K8sObject {
    return "metadata" in (resource as any);
}
