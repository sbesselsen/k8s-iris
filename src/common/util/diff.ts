import { deepEqual } from "./deep-equal";

type Diff = Array<Operation>;

type Operation = Replace | Insert | Delete | Descend;

type Replace = { type: "replace"; value: unknown };
type Insert = { type: "insert"; value: unknown; atIndex: number };
type Delete = { type: "delete"; key: string | number };
type Descend = { type: "descend"; key: string | number; diff: Diff };

export function diff(a: unknown, b: unknown): Diff {
    if (a === b) {
        return [];
    }
    if (typeof a !== "object") {
        if (a !== b) {
            return [{ type: "replace", value: b }];
        }
        return [];
    }
    if (typeof b !== "object") {
        return [{ type: "replace", value: b }];
    }
    // A and B are both references to different objects.
    if (Array.isArray(a)) {
        if (Array.isArray(b)) {
            // Diff between two arrays.
            return arrayDiff(a, b);
        }
        return [{ type: "replace", value: b }];
    }
    return objectDiff(a, b);
}

function arrayDiff(a: unknown[], b: unknown[]): Diff {
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

function keyedArrayDiff(key: string, a: unknown[], b: unknown[]): Diff {
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
): Diff {
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
    const output: Diff = [];
    let currentIndex = 0;
    while (entry) {
        const { action, indexA, indexB, nextEntry } = entry;
        switch (action) {
            case "delete":
                output.push({ type: "delete", key: currentIndex });
                break;
            case "insert":
                output.push({
                    type: "insert",
                    value: b[indexB],
                    atIndex: currentIndex,
                });
                currentIndex++;
                break;
            case "merge":
                const subDiff = diff(a[indexA], b[indexB]);
                if (subDiff.length > 0) {
                    output.push({
                        type: "descend",
                        key: currentIndex,
                        diff: subDiff,
                    });
                }
                currentIndex++;
                break;
        }
        entry = nextEntry;
    }
    return output;
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
    const output: Diff = [];
    const keysA = new Set(Object.keys(a));
    const keysB = new Set(Object.keys(b));
    for (const key of keysB) {
        let subDiff: Diff;
        if (keysA.has(key)) {
            // Both objects have this key.
            subDiff = diff(a[key], b[key]);
        } else {
            subDiff = [{ type: "replace", value: b[key] }];
        }
        if (subDiff.length > 0) {
            output.push({ type: "descend", key, diff: subDiff });
        }
    }
    for (const key of keysA) {
        if (!keysB.has(key)) {
            output.push({ type: "delete", key });
        }
    }
    return output;
}

export function applyDiff(a: unknown, diff: Diff): unknown {
    const isArray = Array.isArray(a);
    for (const item of diff) {
        switch (item.type) {
            case "delete":
                if (isArray) {
                    a.splice(item.key as number, 1);
                } else {
                    delete a[item.key];
                }
                break;
            case "insert":
                if (isArray) {
                    a.splice(item.atIndex, 0, item.value);
                }
                break;
            case "replace":
                return item.value;
            case "descend":
                a[item.key] = applyDiff(a[item.key], item.diff);
                break;
        }
    }
    return a;
}
