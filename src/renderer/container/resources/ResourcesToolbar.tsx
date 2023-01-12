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
import {
    resourceEditor,
    newResourceEditor,
    useAppEditorsStore,
} from "../../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../../context/route";
import { useIpcCall } from "../../hook/ipc";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import {
    useK8sDeleteAction,
    useK8sPauseAction,
    useK8sResumeAction,
} from "../../k8s/actions";

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

    const deleteResource = useK8sDeleteAction();

    const onClickDelete = useCallback(async () => {
        setIsDeleting(true);
        const { willDelete } = await deleteResource(resources);
        if (willDelete) {
            onClearSelection?.();
        }
        setIsDeleting(false);
    }, [deleteResource, resources, onClearSelection, setIsDeleting]);

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
    const pause = useK8sPauseAction();
    const onClickPause = useCallback(async () => {
        setIsPausing(true);
        await pause(resources);
        setIsPausing(false);
    }, [pause, resources, setIsPausing]);

    const [isResuming, setIsResuming] = useState(false);
    const resume = useK8sResumeAction();
    const onClickResume = useCallback(async () => {
        setIsResuming(true);
        await resume(resources);
        setIsResuming(false);
    }, [resources, resume, setIsResuming]);

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
                <IconButton
                    icon={<EditIcon />}
                    aria-label="Bulk open editor"
                    title="Bulk open editor"
                    onClick={onClickBulkEdit}
                />
            )}
            {resources.length > 0 && (
                <IconButton
                    icon={<DeleteIcon />}
                    aria-label="Delete"
                    title="Delete"
                    onClick={onClickDelete}
                    isLoading={isDeleting}
                />
            )}
            {(isPausable || isResumable) && (
                <>
                    {isPausable && (
                        <IconButton
                            icon={<Icon as={MdOutlinePause} />}
                            aria-label="Pause"
                            title="Pause"
                            onClick={onClickPause}
                            isLoading={isPausing}
                        />
                    )}
                    {isResumable && (
                        <IconButton
                            icon={<Icon as={MdPlayArrow} />}
                            aria-label="Resume"
                            title="Resume"
                            onClick={onClickResume}
                            isLoading={isResuming}
                        />
                    )}
                </>
            )}
        </Toolbar>
    );
};
