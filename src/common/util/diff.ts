import { deepEqual } from "./deep-equal";

export type Diff = DiffValue | DiffArray | DiffObject | DiffDelete | null;

export type DiffValue = { diff: "value"; value: unknown };
export type DiffArray = {
    diff: "array";
    diffs: Array<
        DiffArrayItemDelete | DiffArrayItemInsert | DiffArrayItemDescend
    >;
};
export type DiffArrayItemDelete = {
    diff: "delete";
    index: number;
};
export type DiffArrayItemInsert = {
    diff: "insert";
    index: number;
    value: unknown;
};
export type DiffArrayItemDescend = {
    diff: "descend";
    index: number;
    subDiff: Diff;
};
export type DiffArrayUpdate = { index: number; update: Diff };
export type DiffObject = { diff: "object"; diffs: Record<string, Diff> };
export type DiffDelete = { diff: "delete" };

function clone<T>(a: T): T {
    return JSON.parse(JSON.stringify(a));
}

export function diff(a: unknown, b: unknown): Diff {
    if (a === b) {
        return null;
    }
    if (typeof a !== "object") {
        if (a !== b) {
            return { diff: "value", value: clone(b) };
        }
        return null;
    }
    if (typeof b !== "object") {
        return { diff: "value", value: clone(b) };
    }
    // A and B are both references to different objects.
    if (Array.isArray(a)) {
        if (Array.isArray(b)) {
            // Diff between two arrays.
            return arrayDiff(a, b);
        }
        return { diff: "value", value: clone(b) };
    }
    return objectDiff(a, b);
}

function arrayDiff(a: unknown[], b: unknown[]): DiffArray {
    const keysA = detectKeys(a);
    if (keysA.size > 0) {
        const keysB = detectKeys(b);
        for (const key of keysA) {
            if (keysB.has(key)) {
                return keyedArrayDiff(key, a, b);
            }
        }
    }

    return linearDiff(a, b, (itemA, itemB) => deepEqual(itemA, itemB));
}

function keyedArrayDiff(key: string, a: unknown[], b: unknown[]): DiffArray {
    return linearDiff(
        a,
        b,
        (itemA, itemB) => itemA && itemB && itemA[key] === itemB[key]
    );
}

function linearDiff(
    a: unknown[],
    b: unknown[],
    isEqualRef: (itemA: unknown, itemB: unknown) => boolean
): DiffArray {
    type Entry = {
        indexA: number;
        indexB: number;
        cost: number;
        nextEntry: Entry | null;
        action: "insert" | "delete" | "merge";
    };
    const cache: Record<string, Entry> = {};
    const maxSpan = 10;
    const partialLinearDiff = (
        indexA: number,
        indexB: number
    ): Entry | null => {
        const cacheKey = `${indexA}-${indexB}`;
        if (!cache[cacheKey]) {
            if (indexA >= a.length) {
                if (indexB >= b.length) {
                    cache[cacheKey] = null;
                } else {
                    // Only inserts from here on out.
                    const nextEntry = partialLinearDiff(indexA, indexB + 1);
                    cache[cacheKey] = {
                        indexA,
                        indexB,
                        cost: (nextEntry?.cost ?? 0) + 1,
                        action: "insert",
                        nextEntry,
                    };
                }
            } else if (indexB >= b.length) {
                // Only deletes from here on out.
                const nextEntry = partialLinearDiff(indexA + 1, indexB);
                cache[cacheKey] = {
                    indexA,
                    indexB,
                    cost: (nextEntry?.cost ?? 0) + 1,
                    action: "delete",
                    nextEntry,
                };
            } else {
                if (isEqualRef(a[indexA], b[indexB])) {
                    const nextEntry = partialLinearDiff(indexA + 1, indexB + 1);
                    cache[cacheKey] = {
                        indexA,
                        indexB,
                        cost: nextEntry?.cost ?? 0,
                        action: "merge",
                        nextEntry,
                    };
                } else {
                    if (indexA - indexB === maxSpan) {
                        const insertEntry = partialLinearDiff(
                            indexA,
                            indexB + 1
                        );
                        cache[cacheKey] = {
                            indexA,
                            indexB,
                            cost: insertEntry.cost + 1,
                            action: "insert",
                            nextEntry: insertEntry,
                        };
                    } else if (indexB - indexA === maxSpan) {
                        const deleteEntry = partialLinearDiff(
                            indexA + 1,
                            indexB
                        );
                        cache[cacheKey] = {
                            indexA,
                            indexB,
                            cost: deleteEntry.cost + 1,
                            action: "delete",
                            nextEntry: deleteEntry,
                        };
                    } else {
                        const insertEntry = partialLinearDiff(
                            indexA,
                            indexB + 1
                        );
                        const deleteEntry = partialLinearDiff(
                            indexA + 1,
                            indexB
                        );
                        if (
                            insertEntry &&
                            (!deleteEntry ||
                                deleteEntry.cost > insertEntry.cost)
                        ) {
                            cache[cacheKey] = {
                                indexA,
                                indexB,
                                cost: insertEntry.cost + 1,
                                action: "insert",
                                nextEntry: insertEntry,
                            };
                        } else if (deleteEntry) {
                            cache[cacheKey] = {
                                indexA,
                                indexB,
                                cost: deleteEntry.cost + 1,
                                action: "delete",
                                nextEntry: deleteEntry,
                            };
                        } else {
                            cache[cacheKey] = null;
                        }
                    }
                }
            }
        }
        return cache[cacheKey];
    };
    let entry: Entry = partialLinearDiff(0, 0);
    const diffs: Array<
        DiffArrayItemDelete | DiffArrayItemInsert | DiffArrayItemDescend
    > = [];
    let currentIndex = 0;
    while (entry) {
        const { action, indexA, indexB, nextEntry } = entry;
        switch (action) {
            case "delete":
                diffs.push({ diff: "delete", index: currentIndex });
                break;
            case "insert":
                diffs.push({
                    diff: "insert",
                    index: currentIndex,
                    value: b[indexB],
                });
                currentIndex++;
                break;
            case "merge":
                const subDiff = diff(a[indexA], b[indexB]);
                if (subDiff !== null) {
                    diffs.push({
                        diff: "descend",
                        index: currentIndex,
                        subDiff: subDiff,
                    });
                }
                currentIndex++;
                break;
        }
        entry = nextEntry;
    }
    return { diff: "array", diffs };
}

function detectKeys(a: unknown[]): Set<string> {
    const potentialKeys = ["id", "name", "key"];
    const output: Set<string> = new Set();
    for (const potentialKey of potentialKeys) {
        if (isSuitableKey(potentialKey, a)) {
            output.add(potentialKey);
        }
    }
    return output;
}

function isSuitableKey(key: string, a: unknown[]): boolean {
    const values: unknown[] = [];
    for (const item of a) {
        if (typeof item !== "object") {
            return false;
        }
        if (!(key in item)) {
            return false;
        }
        const value = item[key];
        if (value && typeof value === "object") {
            return false;
        }
        if (values.includes(value)) {
            return false;
        }
        values.push(value);
    }
    return true;
}

function objectDiff(a: object, b: object): Diff {
    const diffs: Record<string, Diff> = {};
    const keysA = new Set(Object.keys(a));
    const keysB = new Set(Object.keys(b));
    let hasDiff = false;
    for (const key of keysB) {
        if (keysA.has(key)) {
            // Both objects have this key.
            const d = diff(a[key], b[key]);
            if (d) {
                hasDiff = true;
                diffs[key] = d;
            }
        } else {
            hasDiff = true;
            const value = b[key];
            if (typeof value === "object" && !Array.isArray(value)) {
                diffs[key] = objectDiff({}, value);
            } else {
                diffs[key] = { diff: "value", value };
            }
        }
    }
    for (const key of keysA) {
        if (!keysB.has(key)) {
            hasDiff = true;
            diffs[key] = { diff: "delete" };
        }
    }
    return hasDiff ? { diff: "object", diffs } : null;
}

export function cloneAndApply(a: unknown, diff: Diff): unknown {
    return apply(clone(a), diff);
}

export function apply(a: unknown, diff: Diff): unknown {
    if (diff === null) {
        return a;
    }
    switch (diff.diff) {
        case "array":
            return Array.isArray(a) ? arrayApply(a, diff.diffs) : [];
        case "delete":
            return undefined;
        case "object":
            return objectApply(a, diff.diffs);
            break;
        case "value":
            return diff.value;
    }
}

function arrayApply(
    a: unknown[],
    diffs: Array<
        DiffArrayItemDelete | DiffArrayItemInsert | DiffArrayItemDescend
    >
): unknown {
    for (const diff of diffs) {
        switch (diff.diff) {
            case "delete":
                a.splice(diff.index, 1);
                break;
            case "insert":
                a.splice(diff.index, 0, diff.value);
                break;
            case "descend":
                a[diff.index] = apply(a[diff.index], diff.subDiff);
                break;
        }
    }
    return a;
}

function objectApply(a: unknown, diffs: Record<string, Diff>): unknown {
    if (!a) {
        a = {};
    }
    for (const key of Object.keys(diffs)) {
        const diff = diffs[key];
        if (diff === null) {
            continue;
        }
        switch (diff.diff) {
            case "array":
                a[key] = arrayApply(a[key], diff.diffs);
                break;
            case "delete":
                delete a[key];
                break;
            case "object":
                a[key] = objectApply(a[key], diff.diffs);
                break;
            case "value":
                a[key] = diff.value;
                break;
        }
    }
    return a;
}

// export type MergeConflict = {
//     path: string[];
//     leftOperation: Operation;
//     rightOperation: Operation;
// };

// export function mergeDiffs(
//     a: Diff,
//     b: Diff
// ):
//     | { success: true; diff: Diff }
//     | { success: false; conflicts: MergeConflict[] } {

//     // Replace | Insert | Delete | Descend

//     return { success: true, diff: [] };
// }
