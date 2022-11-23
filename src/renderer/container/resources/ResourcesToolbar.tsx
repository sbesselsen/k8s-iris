import { AddIcon, DeleteIcon, EditIcon, Icon } from "@chakra-ui/icons";
import { Box, Button, ButtonGroup, IconButton } from "@chakra-ui/react";
import { MdOutlinePause, MdPlayArrow } from "react-icons/md";
import React, { useCallback, useMemo, useState } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { isSetLike } from "../../../common/k8s/util";
import { Toolbar } from "../../component/main/Toolbar";
import { useContextLockHelpers } from "../../context/context-lock";
import {
    resourceEditor,
    isEditorForResource,
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

    const { checkContextLock } = useContextLockHelpers();

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
        const newEditors = resources?.map(resourceEditor) ?? [];
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
            if (!(await checkContextLock())) {
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
                        (e) => !resources.some((r) => isEditorForResource(e, r))
                    )
                );
            }
        })();
    }, [
        appEditorStore,
        client,
        checkContextLock,
        resources,
        onClearSelection,
        setIsDeleting,
        showDialog,
    ]);

    const isScalable = useMemo(
        () => resources.every((r) => isSetLike(r) && r.kind !== "DaemonSet"),
        [resources]
    );
    const isPausable = useMemo(
        () =>
            isScalable && resources.some((r) => (r as any)?.spec?.replicas > 0),
        [isScalable, resources]
    );
    const isResumable = useMemo(
        () =>
            isScalable &&
            resources.some((r) => (r as any)?.spec?.replicas === 0),
        [isScalable, resources]
    );

    const [isPausing, setIsPausing] = useState(false);
    const onClickPause = useCallback(async () => {
        if (resources.length === 0) {
            return;
        }
        if (!(await checkContextLock())) {
            return;
        }
        const result = await showDialog({
            title: "Are you sure?",
            type: "question",
            message: `Are you sure you want to pause ${
                resources.length === 1
                    ? resources[0].metadata.name
                    : resources.length + " resources"
            }?`,
            detail: `This will effectively switch ${
                resources.length === 1 ? "it" : "them"
            } off and make ${
                resources.length === 1 ? "it" : "them"
            } unavailable.`,
            buttons: ["Yes", "No"],
        });
        if (result.response === 1) {
            return;
        }
        const errors: string[] = [];
        setIsPausing(true);
        await Promise.all(
            resources.map(async (resource) => {
                const originalScale = (resource as any)?.spec?.replicas ?? 1;
                if (originalScale === 0) {
                    return;
                }
                try {
                    await client.apply({
                        ...resource,
                        metadata: {
                            ...resource.metadata,
                            annotations: {
                                ...resource.metadata.annotations,
                                "irisapp.dev/original-replicas":
                                    String(originalScale),
                            },
                        },
                        spec: {
                            ...(resource as any).spec,
                            replicas: 0,
                        },
                    } as K8sObject);
                } catch (e) {
                    errors.push(e.message);
                }
            })
        );
        setIsPausing(false);
        if (errors.length > 0) {
            console.error("Errors while scaling", errors);
            showDialog({
                title: "Error while scaling",
                type: "error",
                message: "An error occurred while applying the new scale:",
                detail:
                    errors.length === 1
                        ? errors[0]
                        : errors.map((e) => `- ${e}`).join("\n"),
                buttons: ["OK"],
            });
        }
    }, [client, checkContextLock, resources, setIsPausing, showDialog]);

    const [isResuming, setIsResuming] = useState(false);
    const onClickResume = useCallback(async () => {
        if (resources.length === 0) {
            return;
        }
        if (!(await checkContextLock())) {
            return;
        }
        const errors: string[] = [];
        setIsResuming(true);
        await Promise.all(
            resources.map(async (resource) => {
                let targetScale = 1;
                if (
                    (resource as any)?.metadata?.annotations?.[
                        "irisapp.dev/original-replicas"
                    ]
                ) {
                    const originalScale = parseInt(
                        (resource as any).metadata.annotations[
                            "irisapp.dev/original-replicas"
                        ],
                        10
                    );
                    if (originalScale > 0 && !isNaN(originalScale)) {
                        targetScale = originalScale;
                    }
                }
                const annotations = { ...resource.metadata.annotations };
                delete annotations["irisapp.dev/original-replicas"];

                try {
                    await client.apply({
                        ...resource,
                        metadata: {
                            ...resource.metadata,
                            annotations,
                        },
                        spec: {
                            ...(resource as any).spec,
                            replicas: targetScale,
                        },
                    } as K8sObject);
                } catch (e) {
                    errors.push(e.message);
                }
            })
        );
        setIsResuming(false);
        if (errors.length > 0) {
            console.error("Errors while scaling", errors);
            showDialog({
                title: "Error while scaling",
                type: "error",
                message: "An error occurred while applying the new scale:",
                detail:
                    errors.length === 1
                        ? errors[0]
                        : errors.map((e) => `- ${e}`).join("\n"),
                buttons: ["OK"],
            });
        }
    }, [client, checkContextLock, resources, setIsResuming, showDialog]);

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
            {(isPausable || isResumable) && (
                <>
                    <Box flex="1 0 0" />
                    <ButtonGroup isAttached>
                        {isPausable && (
                            <IconButton
                                colorScheme="primary"
                                icon={<Icon as={MdOutlinePause} />}
                                aria-label="Pause"
                                title="Pause"
                                onClick={onClickPause}
                                isLoading={isPausing}
                            />
                        )}
                        {isResumable && (
                            <IconButton
                                colorScheme="primary"
                                icon={<Icon as={MdPlayArrow} />}
                                aria-label="Resume"
                                title="Resume"
                                onClick={onClickResume}
                                isLoading={isResuming}
                            />
                        )}
                    </ButtonGroup>
                </>
            )}
        </Toolbar>
    );
};
