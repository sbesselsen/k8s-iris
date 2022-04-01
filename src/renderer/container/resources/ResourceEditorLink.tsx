import { Link, LinkProps } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { K8sObject } from "../../../common/k8s/client";
import {
    appEditorForK8sObject,
    useAppEditorsSetter,
    useAppEditorUpdater,
} from "../../context/editors";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";

export type ResourceEditorLinkProps = LinkProps & {
    editorResource: K8sObject;
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
        const editor = appEditorForK8sObject(editorResource);
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
