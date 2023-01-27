import { useCallback, useMemo } from "react";
import { difference } from "../../common/util/set";

export function useMultiSelectUpdater<T>(
    allValues: T[],
    currentSelection: T[] = []
): (newSelection: T[], withRangeModifier?: boolean) => T[] {
    const processor = useMemo(
        () => createMultiSelectProcessor(allValues),
        [allValues]
    );

    return useCallback(
        (newSelection, withRangeModifier) => {
            const selected = processor(
                new Set(newSelection),
                new Set(currentSelection),
                withRangeModifier ?? false
            );
            return allValues.filter((value) => selected.has(value));
        },
        [processor, currentSelection]
    );
}

/**
 * Create a contiguous range from allValues which includes all items.
 */
function expandRange<T>(allValues: T[], items: Set<T>): Set<T> {
    const remainingItems = new Set([...items]);
    let inRange = false;
    const range: Set<T> = new Set();
    for (const item of allValues) {
        if (remainingItems.size === 0) {
            break;
        }
        if (remainingItems.has(item)) {
            inRange = true;
            remainingItems.delete(item);
        }
        if (inRange) {
            range.add(item);
        }
    }
    return range;
}

export type MultiSelectProcessor<T> = (
    newSelection: Set<T>,
    prevSelection: Set<T>,
    makeRange: boolean
) => Set<T>;

export function createMultiSelectProcessor<T>(
    allValues: T[]
): MultiSelectProcessor<T> {
    let prevToggledItems = new Set<T>();

    return (newSelection, prevSelection, makeRange) => {
        let added = difference(newSelection, prevSelection);
        let removed = difference(prevSelection, newSelection);

        // Remember that these were the items we clicked last.
        const toggledItems = new Set([...added, ...removed]);

        // When shift-clicking to select a range, select/deselect more items.
        if (makeRange) {
            if (added.size > 0) {
                added = expandRange(
                    allValues,
                    new Set([...prevToggledItems, ...added])
                );
            }
            if (removed.size > 0) {
                removed = expandRange(
                    allValues,
                    new Set([...prevToggledItems, ...removed])
                );
            }
        }

        prevToggledItems = toggledItems;

        return new Set(
            allValues.filter(
                (item) =>
                    added.has(item) ||
                    (prevSelection.has(item) && !removed.has(item))
            )
        );
    };
}
