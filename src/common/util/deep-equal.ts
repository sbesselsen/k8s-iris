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

function shallowEqualArrays(a: any[], b: any[]): boolean {
    return a.every((val, i) => val === b[i]);
}
