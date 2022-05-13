import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { AppEditor } from "../../common/route/app-route";
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
