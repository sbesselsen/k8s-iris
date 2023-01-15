import { AddIcon } from "@chakra-ui/icons";
import { Button } from "@chakra-ui/react";
import React, { useCallback } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { Toolbar } from "../../component/main/Toolbar";
import { newResourceEditor, useAppEditorsStore } from "../../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useIpcCall } from "../../hook/ipc";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { useK8sDeleteAction } from "../../k8s/actions";
import { ResourceActionButtons } from "./ResourceActionButtons";

export type ResourcesToolbarProps = {
    resourceType?: K8sResourceTypeIdentifier;
    resources?: K8sObject[];
    onClearSelection?: () => void;
};

export const ResourcesToolbar: React.FC<ResourcesToolbarProps> = (props) => {
    const { onClearSelection, resourceType, resources = [] } = props;

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const appEditorsStore = useAppEditorsStore();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const altKeyRef = useModifierKeyRef("Alt");
    const metaKeyRef = useModifierKeyRef("Meta");
    const shiftKeyRef = useModifierKeyRef("Shift");

    const onClickAddNew = useCallback(
        (supportNewWindow = true) => {
            const editor = newResourceEditor(resourceType);
            if (supportNewWindow && metaKeyRef.current) {
                createWindow({
                    route: {
                        ...getAppRoute(),
                        activeEditor: editor,
                        isSidebarVisible: false,
                    },
                });
            } else if (altKeyRef.current) {
                // Option+click: open in background.
                appEditorsStore.set((editors) => {
                    return [...editors, editor];
                });
            } else {
                setAppRoute((route) => ({
                    ...route,
                    activeEditor: editor,
                }));
            }
        },
        [
            appEditorsStore,
            createWindow,
            getAppRoute,
            setAppRoute,
            altKeyRef,
            metaKeyRef,
            resourceType,
        ]
    );

    const deleteResource = useK8sDeleteAction();

    const onClickDelete = useCallback(async () => {
        const { willDelete } = await deleteResource(resources);
        if (willDelete) {
            onClearSelection?.();
        }
    }, [deleteResource, resources, onClearSelection]);

    useKeyListener(
        useCallback(
            (event, key) => {
                if (
                    event === "keydown" &&
                    key === "n" &&
                    metaKeyRef.current &&
                    !shiftKeyRef.current
                ) {
                    onClickAddNew(false);
                }
                if (event === "keydown" && key === "Delete") {
                    if (resources?.length > 0) {
                        onClickDelete();
                    }
                }
            },
            [onClickAddNew, onClickDelete, metaKeyRef, shiftKeyRef, resources]
        )
    );

    return (
        <Toolbar>
            <Button onClick={onClickAddNew} leftIcon={<AddIcon w={2} h={2} />}>
                New
            </Button>
            {resources.length > 0 && (
                <ResourceActionButtons resources={resources} />
            )}
        </Toolbar>
    );
};
