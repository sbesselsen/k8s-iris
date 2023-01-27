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
>(oldObject: T, newObject: T): T {
    return shallowEqualObjects(oldObject, newObject) ? oldObject : newObject;
}

/**
 * Wrap a function to make it return its previous return value as long as the new one is shallow equal to the old.
 */
export function shallowEqualWrap<T extends Array<any>, U>(
    f: (...args: T) => U
): (...args: T) => U {
    let prevValue: U | undefined;
    return (...args) => {
        const newValue = f(...args);
        if (Array.isArray(newValue) && Array.isArray(prevValue)) {
            if (shallowEqualArrays(newValue, prevValue)) {
                return prevValue;
            }
        } else if (
            typeof newValue === "object" &&
            typeof prevValue === "object" &&
            newValue &&
            prevValue
        ) {
            if (shallowEqualObjects(newValue, prevValue)) {
                return prevValue;
            }
        }
        prevValue = newValue;
        return newValue;
    };
}
