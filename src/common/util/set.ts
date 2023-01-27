export function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
    const out = new Set<T>();
    for (const item of a) {
        if (!b.has(item)) {
            out.add(item);
        }
    }
    return out;
}

export function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
    const out = new Set<T>();
    for (const item of a) {
        if (b.has(item)) {
            out.add(item);
        }
    }
    return out;
}

export function union<T>(a: Set<T>, b: Set<T>): Set<T> {
    const out = new Set(a);
    for (const item of b) {
        out.add(item);
    }
    return out;
}

export function applyMutations(
    a: Set<string>,
    mutations: Record<string, boolean>
): Set<string> {
    const out = new Set(a);
    for (const [k, v] of Object.entries(mutations)) {
        if (v) {
            out.add(k);
        } else {
            out.delete(k);
        }
    }
    return out;
}
