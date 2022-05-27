import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import { Button, IconButton } from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { Toolbar } from "../../component/main/Toolbar";
import {
    isAppEditorForK8sObject,
    newResourceEditor,
    useAppEditorsStore,
} from "../../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useDialog } from "../../hook/dialog";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sClient } from "../../k8s/client";

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

    const showDialog = useDialog();
    const appEditorStore = useAppEditorsStore();
    const client = useK8sClient();

    const onClickAddNew = useCallback(() => {
        const editor = newResourceEditor(resourceType);
        if (metaKeyRef.current) {
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
    }, [
        appEditorsStore,
        createWindow,
        getAppRoute,
        setAppRoute,
        altKeyRef,
        metaKeyRef,
        resourceType,
    ]);

    const [isDeleting, setIsDeleting] = useState(false);

    const onClickDelete = useCallback(() => {
        (async () => {
            const detail =
                resources.length === 1
                    ? `Are you sure you want to delete this resource?`
                    : `Are you sure you want to delete these ${resources.length.toLocaleString()} resources?`;
            const result = await showDialog({
                title: "Confirm deletion",
                message: "Are you sure?",
                detail,
                buttons: ["Yes", "No"],
            });
            if (result.response === 0) {
                setIsDeleting(true);
                await Promise.all(
                    resources.map((r) =>
                        client.remove(r, { waitForCompletion: false })
                    )
                );
                onClearSelection?.();
                setIsDeleting(false);

                // Close the corresponding editors.
                // TODO: again, this coupling is bad, we want to do it automatically
                appEditorStore.set((editors) =>
                    editors.filter(
                        (e) =>
                            !resources.some((r) =>
                                isAppEditorForK8sObject(e, r)
                            )
                    )
                );
            }
        })();
    }, [appEditorStore, client, resources, onClearSelection, setIsDeleting]);

    return (
        <Toolbar>
            <Button
                colorScheme="primary"
                onClick={onClickAddNew}
                leftIcon={<AddIcon w={2} h={2} />}
            >
                New
            </Button>
            {resources.length > 0 && (
                <IconButton
                    colorScheme="primary"
                    icon={<DeleteIcon />}
                    aria-label="Delete"
                    title="Delete"
                    onClick={onClickDelete}
                    isLoading={isDeleting}
                />
            )}
        </Toolbar>
    );
};
