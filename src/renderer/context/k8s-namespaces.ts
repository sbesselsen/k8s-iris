import { create } from "../util/state";

let defaultK8sNamespaces: string[] = [];
const searchString = window.location.search;
if (searchString) {
    defaultK8sNamespaces =
        JSON.parse(atob(searchString.slice(1))).namespaces ?? [];
}

export const [useK8sNamespacesStore, useK8sNamespaces] =
    create(defaultK8sNamespaces);
