export function deepEqual(a: any, b: any): boolean {
    if (!a || !b || typeof a !== "object") {
        return a === b;
    }
    if (Array.isArray(a)) {
        if (!Array.isArray(b)) {
            return false;
        }
        return deepEqualArrays(a, b);
    }

    // Two objects.
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (!shallowEqualArrays(aKeys, bKeys)) {
        return false;
    }
    // Two objects with the same keys.
    for (const k of aKeys) {
        if (!deepEqual(b[k], a[k])) {
            return false;
        }
    }
    return true;
}

function deepEqualArrays(a: any[], b: any[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((val, i) => deepEqual(val, b[i]));
}

export function shallowEqualArrays(a: any[], b: any[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
}

export function shallowEqualObjects(a: any, b: any): boolean {
    if (a === b) {
        return true;
    }

    // Two objects.
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (!shallowEqualArrays(aKeys, bKeys)) {
        return false;
    }
    // Two objects with the same keys.
    for (const k of aKeys) {
        if (a[k] !== b[k]) {
            return false;
        }
    }
    return true;
}

export function reuseShallowEqualObject<
    T extends Record<string | number | symbol, unknown>
>(newObject: T, oldObject: T | undefined | null): T {
    if (oldObject === undefined || oldObject === null) {
        return newObject;
    }
    return shallowEqualObjects(oldObject, newObject) ? oldObject : newObject;
}

export function reuseShallowEqualArray<T extends any[]>(
    newArray: T,
    oldArray: T | undefined | null
): T {
    if (oldArray === undefined || oldArray === null) {
        return newArray;
    }
    return shallowEqualArrays(oldArray, newArray) ? oldArray : newArray;
}
