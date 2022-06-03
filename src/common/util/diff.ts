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
    return typeof a === "object" ? JSON.parse(JSON.stringify(a)) : a;
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
    if (!a || !b) {
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
                        const nextEntries: Entry[] = [];
                        const insertNextEntry = partialLinearDiff(
                            indexA,
                            indexB + 1
                        );
                        if (insertNextEntry) {
                            nextEntries.push({
                                indexA,
                                indexB,
                                cost: insertNextEntry.cost + 1,
                                action: "insert",
                                nextEntry: insertNextEntry,
                            });
                        }
                        const deleteNextEntry = partialLinearDiff(
                            indexA + 1,
                            indexB
                        );
                        if (deleteNextEntry) {
                            nextEntries.push({
                                indexA,
                                indexB,
                                cost: deleteNextEntry.cost + 1,
                                action: "delete",
                                nextEntry: deleteNextEntry,
                            });
                        }
                        const replaceNextEntry = partialLinearDiff(
                            indexA + 1,
                            indexB + 1
                        );
                        if (replaceNextEntry) {
                            nextEntries.push({
                                indexA,
                                indexB,
                                cost: replaceNextEntry.cost + 1,
                                action: "merge",
                                nextEntry: replaceNextEntry,
                            });
                        }
                        cache[cacheKey] =
                            nextEntries.sort((x, y) => x.cost - y.cost)[0] ??
                            null;
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
    return diffs.length > 0 ? { diff: "array", diffs } : null;
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
            if (typeof value === "object" && !Array.isArray(value) && value) {
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

export type MergeConflict = {
    path: Array<string | number>;
    leftDiff:
        | Diff
        | DiffArrayItemDelete
        | DiffArrayItemInsert
        | DiffArrayItemDescend;
    rightDiff:
        | Diff
        | DiffArrayItemDelete
        | DiffArrayItemInsert
        | DiffArrayItemDescend;
};

export type MergeConflictResolver = (
    conflict: MergeConflict
) => MergeConflict["leftDiff"];

export function mergeDiffs(
    a: Diff,
    b: Diff,
    resolveConflict?: MergeConflictResolver
): { diff: Diff; conflicts: MergeConflict[] } {
    const conflicts: MergeConflict[] = [];
    const diff = mergeDiffsInternal(
        a,
        b,
        [],
        resolveConflict ?? (() => null),
        conflicts
    );
    return { diff, conflicts };
}

function handleConflict(
    conflict: MergeConflict,
    resolver: MergeConflictResolver,
    conflicts: MergeConflict[]
): MergeConflict["leftDiff"] {
    const resolution = resolver(conflict);
    if (resolution) {
        return resolution;
    }
    conflicts.push(conflict);
    return null;
}

function mergeDiffsInternal(
    a: Diff,
    b: Diff,
    path: Array<string | number>,
    resolveConflict: MergeConflictResolver,
    conflicts: MergeConflict[]
): Diff {
    if (a === null) {
        return b;
    }
    if (b === null) {
        return a;
    }
    // Both are non-null.
    switch (a.diff) {
        case "array":
            if (b.diff === "array") {
                return mergeArrayDiffs(a, b, path, resolveConflict, conflicts);
            }
            break;
        case "delete":
            if (b.diff === "delete") {
                return a;
            } else {
                return handleConflict(
                    { path, leftDiff: a, rightDiff: b },
                    resolveConflict,
                    conflicts
                ) as Diff;
            }
        case "value":
            if (b.diff === "value" && deepEqual(a.value, b.value)) {
                return a;
            } else {
                return handleConflict(
                    { path, leftDiff: a, rightDiff: b },
                    resolveConflict,
                    conflicts
                ) as Diff;
            }
        case "object":
            if (b.diff === "object") {
                return mergeObjectDiffs(a, b, path, resolveConflict, conflicts);
            } else {
                return handleConflict(
                    { path, leftDiff: a, rightDiff: b },
                    resolveConflict,
                    conflicts
                ) as Diff;
            }
    }
}

function mergeArrayDiffs(
    a: DiffArray,
    b: DiffArray,
    path: Array<string | number>,
    resolveConflict: MergeConflictResolver,
    conflicts: MergeConflict[]
): DiffArray {
    const aDiffs = [...a.diffs].sort((x, y) => x.index - y.index);
    const bDiffs = [...b.diffs].sort((x, y) => x.index - y.index);
    const outDiffs: Array<
        DiffArrayItemDelete | DiffArrayItemInsert | DiffArrayItemDescend
    > = [];
    let aOffset = 0;
    let bOffset = 0;

    const operationOffsets = { delete: -1, insert: 1 };

    while (aDiffs.length > 0 || bDiffs.length > 0) {
        if (aDiffs.length === 0) {
            // Apply the b diff.
            const bDiff = bDiffs.shift();
            outDiffs.push({ ...bDiff, index: bDiff.index + bOffset });
        } else if (bDiffs.length === 0) {
            // Apply the a diff.
            const aDiff = aDiffs.shift();
            outDiffs.push({ ...aDiff, index: aDiff.index + aOffset });
        } else {
            // Combine.
            const aDiff = aDiffs[0];
            const bDiff = bDiffs[0];
            if (aDiff.index + aOffset < bDiff.index + bOffset) {
                // aDiff comes first. Apply it and change b delta.
                aDiffs.shift();
                outDiffs.push({ ...aDiff, index: aDiff.index + aOffset });
                bOffset += operationOffsets[aDiff.diff] ?? 0;
            } else if (bDiff.index + bOffset < aDiff.index + aOffset) {
                // bDiff comes first.
                bDiffs.shift();
                outDiffs.push({ ...bDiff, index: bDiff.index + bOffset });
                aOffset += operationOffsets[bDiff.diff] ?? 0;
            } else {
                // Uh oh. Both operations at the same offset.
                switch (aDiff.diff) {
                    case "insert":
                        switch (bDiff.diff) {
                            case "insert":
                                // Both insert! Accept if they have the same value.
                                if (deepEqual(aDiff.value, bDiff.value)) {
                                    outDiffs.push({
                                        ...aDiff,
                                        index: aDiff.index + aOffset,
                                    });
                                    aDiffs.shift();
                                    bDiffs.shift();
                                } else {
                                    // Insert/insert conflict. We don't know which one should go first.
                                    conflicts.push({
                                        path: [...path, aDiff.index - bOffset],
                                        leftDiff: aDiff,
                                        rightDiff: bDiff,
                                    });
                                    return null;
                                }
                                break;
                            case "delete":
                                // Insert/delete conflict.
                                conflicts.push({
                                    path: [...path, aDiff.index - bOffset],
                                    leftDiff: aDiff,
                                    rightDiff: bDiff,
                                });
                                return null;
                                break;
                            case "descend":
                                // Insert/descend. First insert, next descend.
                                aDiffs.shift();
                                outDiffs.push({
                                    ...aDiff,
                                    index: aDiff.index + aOffset,
                                });
                                bOffset += operationOffsets[aDiff.diff] ?? 0;
                                break;
                        }
                        break;
                    case "delete":
                        switch (bDiff.diff) {
                            case "insert":
                                // Delete/insert conflict. We don't know which one should go first.
                                conflicts.push({
                                    path: [...path, aDiff.index - bOffset],
                                    leftDiff: aDiff,
                                    rightDiff: bDiff,
                                });
                                return null;
                                break;
                            case "delete":
                                // Delete/delete is fine!
                                aDiffs.shift();
                                bDiffs.shift();
                                outDiffs.push({
                                    ...aDiff,
                                    index: aDiff.index + aOffset,
                                });
                                break;
                            case "descend":
                                // Delete/descend conflict. This is a conflict because both want to change the same item.
                                conflicts.push({
                                    path: [...path, aDiff.index - bOffset],
                                    leftDiff: aDiff,
                                    rightDiff: bDiff,
                                });
                                return null;
                        }
                        break;
                    case "descend":
                        switch (bDiff.diff) {
                            case "insert":
                                // Descend/insert. Insert first, then descend.
                                bDiffs.shift();
                                outDiffs.push({
                                    ...bDiff,
                                    index: bDiff.index + bOffset,
                                });
                                aOffset += operationOffsets[bDiff.diff] ?? 0;
                                break;
                            case "delete":
                                // Descend/delete conflict. This is a conflict because both want to change the same item.
                                conflicts.push({
                                    path: [...path, aDiff.index - bOffset],
                                    leftDiff: aDiff,
                                    rightDiff: bDiff,
                                });
                                return null;
                            case "descend":
                                // Descend/descend. Merge!
                                aDiffs.shift();
                                bDiffs.shift();
                                outDiffs.push({
                                    diff: "descend",
                                    index: aDiff.index + aOffset,
                                    subDiff: mergeDiffsInternal(
                                        aDiff.subDiff,
                                        bDiff.subDiff,
                                        [...path, aDiff.index - bOffset],
                                        resolveConflict,
                                        conflicts
                                    ),
                                });
                                break;
                        }
                        break;
                }
            }
        }
    }

    return { diff: "array", diffs: outDiffs };
}

function mergeObjectDiffs(
    a: DiffObject,
    b: DiffObject,
    path: Array<string | number>,
    resolveConflict: MergeConflictResolver,
    conflicts: MergeConflict[]
): DiffObject {
    const aDiffs = a.diffs;
    const bDiffs = b.diffs;
    const aKeys = new Set(Object.keys(aDiffs));
    const bKeys = new Set(Object.keys(bDiffs));
    const outDiffs: Record<string, Diff> = {};
    for (const key of aKeys) {
        if (!bKeys.has(key)) {
            outDiffs[key] = aDiffs[key];
        } else {
            // Potential conflict.
            outDiffs[key] = mergeDiffsInternal(
                aDiffs[key],
                bDiffs[key],
                [...path, key],
                resolveConflict,
                conflicts
            );
        }
    }
    for (const key of bKeys) {
        if (!aKeys.has(key)) {
            outDiffs[key] = bDiffs[key];
        }
    }
    return { diff: "object", diffs: outDiffs };
}
