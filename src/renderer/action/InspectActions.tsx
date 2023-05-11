import { Icon } from "@chakra-ui/icons";
import React, { useCallback } from "react";
import { FiTerminal } from "react-icons/fi";
import { RiTextWrap } from "react-icons/ri";
import { Action, ActionClickResult, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isK8sObject, isSetLike } from "../../common/k8s/util";
import { useContextLockHelpers } from "../context/context-lock";
import { logsEditor, shellEditor } from "../context/editors";
import { useEditorOpener } from "../hook/editor-link";
import { fetchAssociatedPods } from "../k8s/associated-pods";
import { useK8sClient } from "../k8s/client";

function isPod(resource: K8sObject | K8sObjectIdentifier) {
    return resource.apiVersion === "v1" && resource.kind === "Pod";
}

export const InspectActions: React.FC<{}> = () => {
    const { checkContextLock } = useContextLockHelpers();
    const openEditor = useEditorOpener();

    const client = useK8sClient();

    const isShellVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            return resources.every((r) => isSetLike(r) || isPod(r));
        },
        []
    );

    const containerOptions = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            if (resources.length > 1) {
                // Choosing containers becomes a huge mess if we have more than one resource selected.
                // We will let the onClick pick the first container.
                return undefined;
            }
            const resource = resources[0];
            const containers =
                (resource as any).spec?.template?.spec?.containers ??
                (resource as any).spec?.containers ??
                [];
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
            const allObjects: K8sObject[] = [];
            for (const resource of result.resources) {
                if (!isK8sObject(resource)) {
                    continue;
                }
                if (isPod(resource)) {
                    allObjects.push(resource);
                } else {
                    allObjects.push(
                        ...(await fetchAssociatedPods(client, resource))
                    );
                }
            }
            if (allObjects.length === 0) {
                return;
            }
            if (!(await checkContextLock())) {
                return;
            }
            for (const object of allObjects) {
                const containers =
                    (object as any).spec?.template?.spec.containers ??
                    (object as any).spec?.containers;
                const containerName =
                    result.subOptionId ?? containers?.[0]?.name;
                if (!containerName) {
                    return;
                }
                const editor = shellEditor(object, containerName);
                openEditor(editor, {
                    requestNewWindow: result.metaKey,
                    requestBackground: result.altKey || allObjects.length > 1,
                });
            }
        },
        [client, checkContextLock, openEditor]
    );

    const isLogsVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            return resources.every((r) => isSetLike(r) || isPod(r));
        },
        []
    );

    const onClickLogs = useCallback(
        async (result: ActionClickResult) => {
            const allObjects: K8sObject[] = [];
            for (const resource of result.resources) {
                if (!isK8sObject(resource)) {
                    continue;
                }
                if (isPod(resource)) {
                    allObjects.push(resource);
                } else {
                    allObjects.push(
                        ...(await fetchAssociatedPods(client, resource))
                    );
                }
            }
            for (const object of allObjects) {
                const containers =
                    (object as any).spec?.template?.spec.containers ??
                    (object as any).spec?.containers;
                const containerName =
                    result.subOptionId ?? containers?.[0]?.name;
                if (!containerName) {
                    return;
                }
                const editor = logsEditor(object, containerName);
                openEditor(editor, {
                    requestNewWindow: result.metaKey,
                    requestBackground: result.altKey || allObjects.length > 1,
                });
            }
        },
        [client, openEditor]
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
                    buttonIcon={<Icon as={FiTerminal} />}
                />
                <Action
                    id="logs"
                    label="Logs"
                    isVisible={isLogsVisible}
                    onClick={onClickLogs}
                    subOptions={containerOptions}
                    buttonIcon={<Icon as={RiTextWrap} />}
                />
            </ActionGroup>
        </>
    );
};
