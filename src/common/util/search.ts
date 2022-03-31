import { K8sObject } from "../k8s/client";

export function searchMatch(query: string, text: string): boolean {
    const lowerText = text.toLocaleLowerCase();
    const lowerQuery = query.toLocaleLowerCase();
    const parts = lowerQuery.split(/\s+/);
    for (const part of parts) {
        if (lowerText.indexOf(part) === -1) {
            return false;
        }
    }
    return true;
}

export function resourceMatch(query: string, resource: K8sObject): boolean {
    const resourceString = [
        resource.metadata.name,
        resource.metadata.namespace,
        Object.entries(resource.metadata.annotations ?? {})
            .map(([k, v]) => k + "=" + v)
            .join(" "),
        Object.entries(resource.metadata.labels ?? {})
            .map(([k, v]) => k + "=" + v)
            .join(" "),
    ]
        .filter((x) => x)
        .join(" ");
    return searchMatch(query, resourceString);
}
