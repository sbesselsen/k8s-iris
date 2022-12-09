import { useCallback } from "react";
import { K8sObject } from "../../common/k8s/client";
import { uiLabelForObjects } from "../../common/k8s/util";
import { useContextLockHelpers } from "../context/context-lock";
import { isEditorForResource, useAppEditorsStore } from "../context/editors";
import { useDialog } from "../hook/dialog";
import { useK8sClient } from "./client";

export function useK8sDeleteAction(): (
    resources: Array<K8sObject>
) => Promise<{ willDelete: boolean }> {
    const client = useK8sClient();

    const showDialog = useDialog();
    const { checkContextLock } = useContextLockHelpers();

    const appEditorStore = useAppEditorsStore();

    return useCallback(
        async (resources: Array<K8sObject>) => {
            if (resources.length === 0) {
                return { willDelete: false };
            }
            if (!(await checkContextLock())) {
                return { willDelete: false };
            }
            const { label } = uiLabelForObjects(resources);
            const result = await showDialog({
                title: "Confirm delete",
                message: "Are you sure?",
                detail: `Are you sure you want to delete ${label}?`,
                buttons: ["Delete", "Cancel"],
            });
            if (result.response === 0) {
                await Promise.all(
                    resources.map((r) =>
                        client.remove(r, { waitForCompletion: false })
                    )
                );

                // Close the associated editors.
                // TODO: some kind of bus for updates to objects, so we can do this in a central place?
                appEditorStore.set((editors) =>
                    editors.filter((e) =>
                        resources.some((r) => !isEditorForResource(e, r))
                    )
                );
                return { willDelete: true };
            }
            return { willDelete: false };
        },
        [appEditorStore, checkContextLock, client, showDialog]
    );
}

export function useK8sRedeployAction(): (
    resources: Array<K8sObject>
) => Promise<{ willRedeploy: boolean }> {
    const client = useK8sClient();

    const showDialog = useDialog();
    const { checkContextLock } = useContextLockHelpers();

    return useCallback(
        async (resources: Array<K8sObject>) => {
            if (resources.length === 0) {
                return { willRedeploy: false };
            }
            if (!(await checkContextLock())) {
                return { willRedeploy: false };
            }
            const { label } = uiLabelForObjects(resources);
            const result = await showDialog({
                title: "Confirm redeploy",
                message: "Are you sure?",
                detail: `Are you sure you want to redeploy ${label}?`,
                buttons: ["Redeploy", "Cancel"],
            });
            if (result.response === 0) {
                await Promise.all(resources.map((r) => client.redeploy(r)));
                return { willRedeploy: true };
            }
            return { willRedeploy: false };
        },
        [checkContextLock, client, showDialog]
    );
}
