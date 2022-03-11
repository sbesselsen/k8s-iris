import { useCallback, useRef } from "react";

export function useMultiSelectUpdater<T>(
    allValues: T[],
    currentSelection: T[] = []
): (newSelection: T[], withRangeModifier?: boolean) => T[] {
    const prevToggledItemsRef = useRef<Set<T>>(new Set());
    return useCallback(
        (newSelection, withRangeModifier) => {
            const prevToggledItems = prevToggledItemsRef.current;

            const currentSet = new Set(currentSelection);
            const newSet = new Set(newSelection);

            let added = new Set(
                newSelection.filter((item) => !currentSet.has(item))
            );
            let removed = new Set(
                currentSelection.filter((item) => !newSet.has(item))
            );

            // Remember that these were the items we clicked last.
            prevToggledItemsRef.current = new Set([...added, ...removed]);

            // When shift-clicking to select a range, select/deselect more items.
            if (withRangeModifier) {
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

            return allValues.filter(
                (item) =>
                    added.has(item) ||
                    (currentSet.has(item) && !removed.has(item))
            );
        },
        [allValues, currentSelection, prevToggledItemsRef]
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
