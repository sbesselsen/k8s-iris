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

export const InspectActions: React.FC<{}> = () => {
    const { checkContextLock } = useContextLockHelpers();
    const openEditor = useEditorOpener();

    const client = useK8sClient();

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

    const isSingleSetLike = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            if (resources.length !== 1) {
                return false;
            }
            const resource = resources[0];
            return isSetLike(resource);
        },
        [isSetLike]
    );

    const isShellVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            return isSinglePod(resources) || isSingleSetLike(resources);
        },
        [isSinglePod, isSingleSetLike]
    );

    const containerOptions = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
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
            let resource = result.resources[0];
            if (resource && !isSinglePod([resource]) && isK8sObject(resource)) {
                const pods = await fetchAssociatedPods(client, resource);
                if (pods.length === 0) {
                    return;
                }
                resource = pods[0];
            }
            if (!resource || !isK8sObject(resource)) {
                return;
            }
            const containers =
                (resource as any).spec?.template?.spec.containers ??
                (resource as any).spec?.containers;
            const containerName = result.subOptionId ?? containers?.[0]?.name;
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
        [checkContextLock, isSinglePod, openEditor]
    );

    const isLogsVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            return isSinglePod(resources) || isSingleSetLike(resources);
        },
        [isSinglePod, isSingleSetLike]
    );

    const onClickLogs = useCallback(
        async (result: ActionClickResult) => {
            let resource = result.resources[0];
            if (resource && !isSinglePod([resource]) && isK8sObject(resource)) {
                const pods = await fetchAssociatedPods(client, resource);
                if (pods.length === 0) {
                    return;
                }
                resource = pods[0];
            }
            if (!resource || !isK8sObject(resource)) {
                return;
            }
            const containers =
                (resource as any).spec?.template?.spec.containers ??
                (resource as any).spec?.containers;
            const containerName = result.subOptionId ?? containers?.[0]?.name;
            if (!containerName) {
                return;
            }
            const editor = logsEditor(resource, containerName);
            openEditor(editor, {
                requestNewWindow: result.metaKey,
                requestBackground: result.altKey,
            });
        },
        [client, isSinglePod, openEditor]
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
