import React, { useCallback } from "react";
import { Action, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../common/k8s/util";
import { AppEditor } from "../../common/route/app-route";
import { resourceEditor, useAppEditorsStore } from "../context/editors";
import { useAppRouteSetter } from "../context/route";

export const EditActions: React.FC<{
    objects: Array<K8sObject | K8sObjectIdentifier>;
}> = ({ objects }) => {
    const setAppRoute = useAppRouteSetter();

    const appEditorsStore = useAppEditorsStore();

    const onClickEdit = useCallback(() => {
        const identifiers = objects.map(toK8sObjectIdentifier);
        const newEditors: AppEditor[] = identifiers.map(resourceEditor);
        if (objects.length === 1) {
            setAppRoute((route) => ({
                ...route,
                activeEditor: newEditors[0],
            }));
        } else {
            appEditorsStore.set((editors) => {
                const ids = new Set(editors.map((e) => e.id));
                return [
                    ...editors,
                    ...newEditors.filter((e) => !ids.has(e.id)),
                ];
            });
        }
    }, [objects, appEditorsStore, setAppRoute]);

    return (
        <>
            <ActionGroup>
                <Action id="edit" label="Edit" onClick={onClickEdit} />
            </ActionGroup>
        </>
    );
};
