import React, { useCallback } from "react";
import { Action, ActionClickResult, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isK8sObject } from "../../common/k8s/util";
import { useContextLockHelpers } from "../context/context-lock";
import { logsEditor, shellEditor } from "../context/editors";
import { useEditorOpener } from "../hook/editor-link";

export const InspectActions: React.FC<{}> = () => {
    const { checkContextLock } = useContextLockHelpers();
    const openEditor = useEditorOpener();

    const isSinglePod = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            if (resources.length !== 1) {
                return false;
            }
            const resource = resources[0];
            if (!isK8sObject(resource)) {
                return false;
            }
            if (resource.apiVersion !== "v1" || resource.kind !== "Pod") {
                return false;
            }
            return true;
        },
        []
    );
    const isShellVisible = isSinglePod;

    const containerOptions = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            const resource = resources[0];
            const containers = (resource as any).spec?.containers ?? [];
            if (containers.length <= 1) {
                return undefined;
            }

            return containers.map((container: any) => ({
                id: container.name,
                label: container.name,
            }));
        },
        []
    );

    const onClickShell = useCallback(
        async (result: ActionClickResult) => {
            const resource = result.resources[0];
            if (!resource || !isK8sObject(resource)) {
                return;
            }
            const containerName =
                result.subOptionId ??
                (resource as any).spec?.containers?.[0]?.name;
            if (!containerName) {
                return;
            }
            if (!(await checkContextLock())) {
                return;
            }
            const editor = shellEditor(resource, containerName);
            openEditor(editor, {
                requestNewWindow: result.metaKey,
                requestBackground: result.altKey,
            });
        },
        [checkContextLock, openEditor]
    );

    const isLogsVisible = isSinglePod;

    const onClickLogs = useCallback(
        async (result: ActionClickResult) => {
            const resource = result.resources[0];
            if (!resource || !isK8sObject(resource)) {
                return;
            }
            const containerName =
                result.subOptionId ??
                (resource as any).spec?.containers?.[0]?.name;
            if (!containerName) {
                return;
            }
            const editor = logsEditor(resource, containerName);
            openEditor(editor, {
                requestNewWindow: result.metaKey,
                requestBackground: result.altKey,
            });
        },
        [openEditor]
    );

    return (
        <>
            <ActionGroup>
                <Action
                    id="shell"
                    label="Shell"
                    isVisible={isShellVisible}
                    onClick={onClickShell}
                    subOptions={containerOptions}
                />
                <Action
                    id="logs"
                    label="Logs"
                    isVisible={isLogsVisible}
                    onClick={onClickLogs}
                    subOptions={containerOptions}
                />
            </ActionGroup>
        </>
    );
};
