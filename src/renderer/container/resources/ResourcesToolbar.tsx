import { AddIcon, DeleteIcon, EditIcon } from "@chakra-ui/icons";
import { Button, IconButton } from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { Toolbar } from "../../component/main/Toolbar";
import { useContextLock } from "../../context/context-lock";
import {
    appEditorForK8sObject,
    isAppEditorForK8sObject,
    newResourceEditor,
    useAppEditorsStore,
} from "../../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useDialog } from "../../hook/dialog";
import { useIpcCall } from "../../hook/ipc";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
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

    const isClusterLocked = useContextLock();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const altKeyRef = useModifierKeyRef("Alt");
    const metaKeyRef = useModifierKeyRef("Meta");
    const shiftKeyRef = useModifierKeyRef("Shift");

    const showDialog = useDialog();
    const appEditorStore = useAppEditorsStore();
    const client = useK8sClient();

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

    const onClickBulkEdit = useCallback(() => {
        const newEditors = resources?.map(appEditorForK8sObject) ?? [];
        appEditorsStore.set((editors) => {
            const editorIds = new Set(editors.map((e) => e.id));
            return [
                ...newEditors.filter((e) => !editorIds.has(e.id)),
                ...editors,
            ];
        });
    }, [appEditorsStore, resources]);

    const [isDeleting, setIsDeleting] = useState(false);

    const onClickDelete = useCallback(() => {
        (async () => {
            if (isClusterLocked) {
                showDialog({
                    title: "Read-only mode",
                    type: "error",
                    message: "This cluster is in read-only mode.",
                    detail: "You can delete after you click 'Allow changes' in the menu.",
                    buttons: ["OK"],
                });
                return;
            }
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
    }, [
        appEditorStore,
        client,
        isClusterLocked,
        resources,
        onClearSelection,
        setIsDeleting,
        showDialog,
    ]);

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
                    icon={<EditIcon />}
                    aria-label="Bulk open editor"
                    title="Bulk open editor"
                    onClick={onClickBulkEdit}
                />
            )}
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
