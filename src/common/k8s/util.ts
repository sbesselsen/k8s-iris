import {
    K8sObject,
    K8sObjectIdentifier,
    K8sObjectList,
    K8sResourceTypeIdentifier,
} from "./client";

export function objSameRef(
    obj1: K8sObject,
    obj2: K8sObject,
    checkKind = true
): boolean {
    if (!obj1) {
        return !obj2;
    }
    if (!obj2) {
        return false;
    }
    if (checkKind) {
        if (obj1.apiVersion !== obj2.apiVersion || obj1.kind !== obj2.kind) {
            return false;
        }
    }
    return (
        obj1.metadata.name === obj2.metadata.name &&
        obj1.metadata.namespace === obj2.metadata.namespace
    );
}

export function objSameVersion(obj1: K8sObject, obj2: K8sObject): boolean {
    return (
        objSameRef(obj1, obj2) &&
        (obj1 as any).metadata.resourceVersion &&
        (obj1 as any).metadata.resourceVersion ===
            (obj2 as any).metadata.resourceVersion
    );
}

/**
 * Create a new list but use the objects from oldList if they are of the same version.
 *
 * If all objects are the same version, the old list is returned (regardless of order).
 */
export function updateResourceListByVersion(
    oldList: K8sObject[],
    newList: K8sObject[]
): K8sObject[] {
    const oldResourcesByKey = Object.fromEntries(
        oldList.map((resource) => [
            `${resource.apiVersion}:${resource.kind}:${resource.metadata.namespace}:${resource.metadata.name}`,
            resource,
        ])
    );
    let hasChanges = oldList.length !== newList.length;
    const newCombinedList = newList.map((resource) => {
        const key = `${resource.apiVersion}:${resource.kind}:${resource.metadata.namespace}:${resource.metadata.name}`;
        const oldResource = oldResourcesByKey[key];
        if (oldResource && objSameVersion(resource, oldResource)) {
            return oldResource;
        }
        hasChanges = true;
        return resource;
    });
    return hasChanges ? newCombinedList : oldList;
}

export function resourceIdentifier(
    obj: K8sObject | K8sObjectIdentifier
): string {
    if (isK8sObject(obj)) {
        return `${obj.apiVersion}:${obj.kind}:${obj.metadata.namespace ?? ""}:${
            obj.metadata.name
        }`;
    }
    return `${obj.apiVersion}:${obj.kind}:${obj.namespace ?? ""}:${obj.name}`;
}

export function isK8sObject(
    obj: K8sObject | K8sObjectIdentifier
): obj is K8sObject {
    return "metadata" in obj;
}

export function toK8sObjectIdentifier(
    obj: K8sObject | K8sObjectIdentifier
): K8sObjectIdentifier {
    if ("metadata" in obj) {
        return {
            apiVersion: obj.apiVersion,
            kind: obj.kind,
            name: obj.metadata.name,
            ...(obj.metadata.namespace
                ? { namespace: obj.metadata.namespace }
                : {}),
        };
    }
    return obj;
}

export function toK8sObjectIdentifierString(
    obj: K8sObject | K8sObjectIdentifier
): string {
    const identifier = toK8sObjectIdentifier(obj);
    return [
        identifier.apiVersion,
        identifier.kind,
        identifier.namespace ?? "",
        identifier.name,
    ].join(":");
}

export function addListObject<T extends K8sObject = K8sObject>(
    list: K8sObjectList<T>,
    obj: T,
    checkKind = false
): K8sObjectList<T> {
    if (
        list.items.findIndex((item) => objSameRef(item, obj, checkKind)) !== -1
    ) {
        // The item is already in the list.
        return list;
    }
    return { ...list, items: [...list.items, obj] };
}

export function updateListObject<T extends K8sObject = K8sObject>(
    list: K8sObjectList<T>,
    obj: T,
    checkKind = false
): K8sObjectList<T> {
    return {
        ...list,
        items: list.items.map((item) =>
            objSameRef(item, obj, checkKind) ? obj : item
        ),
    };
}

export function deleteListObject<T extends K8sObject = K8sObject>(
    list: K8sObjectList<T>,
    obj: T,
    checkKind = false
): K8sObjectList<T> {
    return {
        ...list,
        items: list.items.filter((item) => !objSameRef(item, obj, checkKind)),
    };
}

export function parseCpu(cpu: string): number | null {
    const match = cpu.match(/^([0-9\.]+)([a-z]?)$/);
    if (!match) {
        return null;
    }
    const number = 1 * (match[1] as any);
    return (
        number /
        (match[2] === "n"
            ? 1000000000
            : match[2] === "u"
            ? 1000000
            : match[2] === "m"
            ? 1000
            : 1)
    );
}

export function parseMemory(
    memory: string,
    targetUnit: "Ki" | "Mi" | "Gi" | "Ti"
): number | null {
    const match = memory.match(/^([0-9\.]+)([a-zA-Z]*)$/);
    if (!match) {
        return null;
    }
    const number = 1 * (match[1] as any);
    const sourceUnit = match[2];
    const unitAdjustments: Record<typeof targetUnit, number> = {
        Ki: 1,
        Mi: 1024,
        Gi: 1024 * 1024,
        Ti: 1024 * 1024 * 1024,
    };
    return (
        (number * (unitAdjustments[sourceUnit] ?? 1)) /
        (unitAdjustments[targetUnit] ?? 1)
    );
}

export function isSetLike(object: K8sResourceTypeIdentifier) {
    if (object.apiVersion === "apps/v1") {
        return (
            object.kind === "Deployment" ||
            object.kind === "StatefulSet" ||
            object.kind === "ReplicaSet" ||
            object.kind === "DaemonSet"
        );
    }
    return false;
}

export function uiLabelForObjects(
    resources: Array<K8sObject | K8sObjectIdentifier>
): { label: string } {
    if (resources.length === 0) {
        return { label: "(none)" };
    }
    const namesByKind: Record<string, string[]> = {};
    for (const resource of resources) {
        const identifier = toK8sObjectIdentifier(resource);
        if (!namesByKind[identifier.kind]) {
            namesByKind[identifier.kind] = [];
        }
        namesByKind[identifier.kind].push(identifier.name);
    }
    const kinds = Object.keys(namesByKind);

    function labelNames(names: string[]): string {
        const maxNamed = 5;
        if (names.length <= maxNamed) {
            return names.join(", ");
        }
        return (
            labelNames(names.slice(0, maxNamed)) +
            `, … (+${names.length - maxNamed})`
        );
    }

    if (kinds.length === 1) {
        return { label: labelNames(namesByKind[kinds[0]]) };
    }
    const kindLabels = kinds.map(
        (kind) => kind.toLocaleLowerCase() + " " + labelNames(namesByKind[kind])
    );
    return { label: kindLabels.join("; ") };
}
