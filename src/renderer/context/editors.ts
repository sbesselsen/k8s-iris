import {
    K8sObject,
    K8sObjectIdentifier,
    K8sResourceTypeIdentifier,
} from "../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../common/k8s/util";
import { AppEditor } from "../../common/route/app-route";
import { create } from "../util/state";

export const { useStore: useAppEditorsStore, useStoreValue: useAppEditors } =
    create([] as AppEditor[]);

export function resourceEditor(
    resource: K8sObject | K8sObjectIdentifier
): AppEditor {
    const resourceIdentifier = toK8sObjectIdentifier(resource);
    return {
        type: "resource",
        id: `${resourceIdentifier.apiVersion}:${resourceIdentifier.kind}:${
            resourceIdentifier.namespace ?? ""
        }:${resourceIdentifier.name}`,
        apiVersion: resourceIdentifier.apiVersion,
        kind: resourceIdentifier.kind,
        name: resourceIdentifier.name,
        namespace: resourceIdentifier.namespace,
    };
}

export function isEditorForResource(
    editor: AppEditor,
    resource: K8sObject | K8sObjectIdentifier
): boolean {
    const resourceIdentifier = toK8sObjectIdentifier(resource);
    if (editor.type === "resource") {
        return (
            editor.apiVersion === resourceIdentifier.apiVersion &&
            editor.kind === resourceIdentifier.kind &&
            editor.name === resourceIdentifier.name &&
            editor.namespace === resourceIdentifier.namespace
        );
    }
    if (editor.type === "pod-shell" || editor.type === "pod-logs") {
        return (
            resourceIdentifier.apiVersion === "v1" &&
            resourceIdentifier.kind === "Pod" &&
            editor.name === resourceIdentifier.name &&
            editor.namespace === resourceIdentifier.namespace
        );
    }
    return false;
}

export function logsEditor(
    resource: K8sObject,
    containerName: string
): AppEditor {
    const resourceIdentifier = toK8sObjectIdentifier(resource);
    if (!resourceIdentifier.namespace) {
        throw new Error("Can only create logs editor for namespaced resources");
    }
    return {
        type: "pod-logs",
        id: `pod-logs:${resourceIdentifier.apiVersion}:${resourceIdentifier.kind}:${resourceIdentifier.namespace}:${resourceIdentifier.name}:${containerName}`,
        name: resourceIdentifier.name,
        namespace: resourceIdentifier.namespace,
        containerName,
    };
}

export function shellEditor(
    resource: K8sObject,
    containerName: string
): AppEditor {
    const resourceIdentifier = toK8sObjectIdentifier(resource);
    if (!resourceIdentifier.namespace) {
        throw new Error("Can only create logs editor for namespaced resources");
    }
    return {
        type: "pod-shell",
        id: `pod-shell:${resourceIdentifier.apiVersion}:${resourceIdentifier.kind}:${resourceIdentifier.namespace}:${resourceIdentifier.name}:${containerName}`,
        name: resourceIdentifier.name,
        namespace: resourceIdentifier.namespace,
        containerName,
    };
}

let newResourceIndex = 1;
export function newResourceEditor(
    resourceType?: K8sResourceTypeIdentifier
): AppEditor {
    const index = newResourceIndex++;
    return {
        id: `new:${index}`,
        type: "new-resource",
        name: `New (${index})`,
        ...resourceType,
    };
}
