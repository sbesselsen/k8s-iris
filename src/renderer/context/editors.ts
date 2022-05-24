import {
    K8sObject,
    K8sObjectIdentifier,
    K8sResourceTypeIdentifier,
} from "../../common/k8s/client";
import { AppEditor } from "../../common/route/app-route";
import { useK8sApiResourceTypes } from "../k8s/api-resources";
import { create } from "../util/state";

export const { useStore: useAppEditorsStore, useStoreValue: useAppEditors } =
    create([] as AppEditor[]);

export function appEditorForK8sObjectIdentifier(
    resource: K8sObjectIdentifier
): AppEditor {
    return {
        type: "resource",
        id: `${resource.apiVersion}:${resource.kind}:${
            resource.namespace ?? ""
        }:${resource.name}`,
        apiVersion: resource.apiVersion,
        kind: resource.kind,
        name: resource.name,
        namespace: resource.namespace,
    };
}

export function appEditorForK8sObject(resource: K8sObject): AppEditor {
    return {
        type: "resource",
        id: `${resource.apiVersion}:${resource.kind}:${
            resource.metadata.namespace ?? ""
        }:${resource.metadata.name}`,
        apiVersion: resource.apiVersion,
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace,
    };
}

export function isAppEditorForK8sObjectIdentifier(
    editor: AppEditor,
    resource: K8sObjectIdentifier
): boolean {
    return (
        editor.type === "resource" &&
        editor.apiVersion === resource.apiVersion &&
        editor.kind === resource.kind &&
        editor.name === resource.name &&
        editor.namespace === resource.namespace
    );
}

export function isAppEditorForK8sObject(
    editor: AppEditor,
    resource: K8sObject
): boolean {
    return (
        editor.type === "resource" &&
        editor.apiVersion === resource.apiVersion &&
        editor.kind === resource.kind &&
        editor.name === resource.metadata.name &&
        editor.namespace === resource.metadata.namespace
    );
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
