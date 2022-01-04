export function groupByKeys<T>(
    items: Array<T>,
    keys: Array<keyof T>,
    sortComparator?: (key: keyof T, a: T[keyof T], b: T[keyof T]) => number
): Array<[Partial<T>, Array<T>]> {
    if (keys.length === 0) {
        return [[{}, items]];
    }
    const [firstKey, ...otherKeys] = keys;
    let groups: Record<string, [Partial<T>, Array<T>]> = {};
    for (const item of items) {
        const group = item[firstKey];
        const groupId = String(group);
        if (!groups[groupId]) {
            groups[groupId] = [{ [firstKey]: group } as Partial<T>, []];
        }
        groups[groupId][1].push(item);
    }
    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 1) {
        groups = { [groupKeys[0]]: [{}, groups[groupKeys[0]][1]] };
    }
    let groupValues = Object.values(groups);
    if (sortComparator) {
        groupValues = groupValues.sort(([a], [b]) =>
            sortComparator(firstKey, a[firstKey], b[firstKey])
        );
    }
    const output: Array<[Partial<T>, Array<T>]> = [];
    for (const [group, subItems] of groupValues) {
        const subGroups = groupByKeys(subItems, otherKeys, sortComparator);
        for (const [subGroup, subItems] of subGroups) {
            output.push([
                {
                    ...group,
                    ...subGroup,
                },
                subItems,
            ]);
        }
    }
    return output;
}
