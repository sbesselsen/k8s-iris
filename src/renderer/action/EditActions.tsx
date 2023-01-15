import { DeleteIcon, EditIcon } from "@chakra-ui/icons";
import React, { useCallback } from "react";
import { Action, ActionClickResult, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isK8sObject, toK8sObjectIdentifier } from "../../common/k8s/util";
import { AppEditor } from "../../common/route/app-route";
import { resourceEditor, useAppEditorsStore } from "../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../context/route";
import { useIpcCall } from "../hook/ipc";
import { useK8sDeleteAction } from "../k8s/actions";

export const EditActions: React.FC<{}> = () => {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const appEditorsStore = useAppEditorsStore();

    const onClickEdit = useCallback(
        (result: ActionClickResult) => {
            const { resources } = result;
            const identifiers = resources.map(toK8sObjectIdentifier);
            const newEditors: AppEditor[] = identifiers.map(resourceEditor);
            if (resources.length === 1 && !result.altKey) {
                if (result.metaKey) {
                    createWindow({
                        route: {
                            ...getAppRoute(),
                            activeEditor: newEditors[0],
                            isSidebarVisible: false,
                        },
                    });
                } else {
                    setAppRoute((route) => ({
                        ...route,
                        activeEditor: newEditors[0],
                    }));
                }
            } else {
                appEditorsStore.set((editors) => {
                    const ids = new Set(editors.map((e) => e.id));
                    return [
                        ...editors,
                        ...newEditors.filter((e) => !ids.has(e.id)),
                    ];
                });
            }
        },
        [appEditorsStore, createWindow, getAppRoute, setAppRoute]
    );

    const deleteIsVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) =>
            resources.every(isK8sObject),
        []
    );

    const deleteFn = useK8sDeleteAction();

    const onClickDelete = useCallback(
        (result: ActionClickResult) => {
            const { resources } = result;
            if (resources.every(isK8sObject)) {
                deleteFn(resources);
            }
        },
        [deleteFn]
    );

    return (
        <>
            <ActionGroup>
                <Action
                    id="edit"
                    label="Edit"
                    onClick={onClickEdit}
                    buttonIcon={<EditIcon />}
                />
                <Action
                    id="delete"
                    label="Delete"
                    isVisible={deleteIsVisible}
                    onClick={onClickDelete}
                    buttonIcon={<DeleteIcon />}
                />
            </ActionGroup>
        </>
    );
};
