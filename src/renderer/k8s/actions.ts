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

export function useK8sPauseAction(): (
    resources: Array<K8sObject>
) => Promise<{ willPause: boolean }> {
    const client = useK8sClient();

    const showDialog = useDialog();
    const { checkContextLock } = useContextLockHelpers();

    return useCallback(
        async (resources) => {
            if (resources.length === 0) {
                return { willPause: false };
            }
            if (!(await checkContextLock())) {
                return { willPause: false };
            }
            const { label } = uiLabelForObjects(resources);
            const result = await showDialog({
                title: "Are you sure?",
                type: "question",
                message:
                    "Pausing workloads will switch them off and make them unavailable.",
                detail: `Are you sure you want to pause ${label}?`,
                buttons: ["Pause", "Cancel"],
            });
            if (result.response === 1) {
                return { willPause: false };
            }
            const errors: string[] = [];
            await Promise.all(
                resources.map(async (resource) => {
                    const originalScale =
                        (resource as any)?.spec?.replicas ?? 1;
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
            return { willPause: true };
        },
        [client, checkContextLock, showDialog]
    );
}

export function useK8sResumeAction(): (
    resources: Array<K8sObject>
) => Promise<{ willResume: boolean }> {
    const client = useK8sClient();

    const showDialog = useDialog();
    const { checkContextLock } = useContextLockHelpers();

    return useCallback(
        async (resources) => {
            if (resources.length === 0) {
                return { willResume: false };
            }
            if (!(await checkContextLock())) {
                return { willResume: false };
            }
            const errors: string[] = [];
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

                    // Never let resume scal something *down*.
                    const currentScale = (resource as any).spec?.replicas;
                    if (currentScale > 1) {
                        targetScale = currentScale;
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
            return { willResume: true };
        },
        [client, checkContextLock, showDialog]
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
