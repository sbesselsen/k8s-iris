import { K8sObject, K8sObjectList } from "./client";

function objSameRef(obj1: K8sObject, obj2: K8sObject): boolean {
    if (!obj1) {
        return !obj2;
    }
    return (
        obj1.apiVersion === obj2.apiVersion &&
        obj1.kind === obj2.kind &&
        obj1.metadata.name === obj2.metadata.name &&
        obj1.metadata.namespace === obj2.metadata.namespace
    );
}

export function addListObject<T extends K8sObject = K8sObject>(
    list: K8sObjectList<T>,
    obj: T
): K8sObjectList<T> {
    if (list.items.findIndex((item) => objSameRef(item, obj)) !== -1) {
        // The item is already in the list.
        return list;
    }
    return { ...list, items: [...list.items, obj] };
}

export function updateListObject<T extends K8sObject = K8sObject>(
    list: K8sObjectList<T>,
    obj: T
): K8sObjectList<T> {
    return {
        ...list,
        items: list.items.map((item) => (objSameRef(item, obj) ? obj : item)),
    };
}

export function deleteListObject<T extends K8sObject = K8sObject>(
    list: K8sObjectList<T>,
    obj: T
): K8sObjectList<T> {
    return {
        ...list,
        items: list.items.filter((item) => !objSameRef(item, obj)),
    };
}
