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
            sortComparator(
                firstKey,
                a[firstKey] as T[keyof T],
                b[firstKey] as T[keyof T]
            )
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

export type Grouping<T, U extends { id: string } = { id: string }> = (
    object: T
) => U | undefined;
export type PostGrouping<T> = (object: T) => {
    accept?: Record<string, (obj: T) => boolean> | undefined;
    seek?: string[] | undefined;
};

export type GroupProcessor<T, U> = (objects: Record<string, T | undefined>) => {
    groups: Record<string, U>;
    members: Record<string, Set<string>>;
};

export function createGroupProcessor<
    T,
    U extends { id: string } = { id: string }
>(
    grouping: Grouping<T, U>,
    postGrouping?: PostGrouping<T>
): GroupProcessor<T, U> {
    let groups: Record<string, U> = {};
    let members: Record<string, Set<string>> = {};
    let result = { groups, members };

    const groupsByKey: Record<string, string> = {};

    const classifyByObjectKey: Record<
        string,
        Record<string, (obj: T) => string | undefined>
    > = {};
    const classifierByTagIncludesKeys: Record<string, Set<string>> = {};
    const classifyByTag: Record<string, (obj: T) => string | undefined> = {};
    const seekersByTag: Record<string, Record<string, T>> = {};

    return (objects: Record<string, T | undefined>) => {
        const retrySeekersForTags: Set<string> = new Set();
        const initMembers = members;
        const initGroups = groups;
        function updateMembers() {
            if (members === initMembers) {
                members = { ...members };
            }
        }
        function updateGroups() {
            if (groups === initGroups) {
                groups = { ...groups };
            }
        }
        function updateMembersOf(groupId: string) {
            updateMembers();
            if (members[groupId] === initMembers[groupId]) {
                members[groupId] = new Set(members[groupId]);
            }
        }

        for (const [key, object] of Object.entries(objects)) {
            if (object === undefined) {
                // Delete object.
                const groupId = groupsByKey[key];
                if (groupId) {
                    updateMembersOf(groupId);
                    members[groupId].delete(key);
                    if (members[groupId].size === 0) {
                        updateGroups();
                        delete groups[groupId];
                        delete members[groupId];
                    }
                } else {
                    // No longer a seeker, that much is for sure.
                    for (const seekers of Object.values(seekersByTag)) {
                        delete seekers[key];
                    }
                }
                delete classifyByObjectKey[key];
                delete groupsByKey[key];
            } else {
                const group = grouping(object);
                if (group !== undefined) {
                    // Add object to normal grouping.
                    groupsByKey[key] = group.id;
                    if (!groups[group.id]) {
                        updateGroups();
                        updateMembers();
                        groups[group.id] = group;
                        members[group.id] = new Set();
                    }
                    if (!members[group.id].has(key)) {
                        updateMembersOf(group.id);
                        members[group.id].add(key);
                    }

                    // See if this object is able to accept others into the group through post-grouping.
                    const postGroup = postGrouping?.(object);
                    if (!postGroup?.accept) {
                        delete classifyByObjectKey[key];
                    } else {
                        classifyByObjectKey[key] = {};
                        Object.entries(postGroup.accept).forEach(
                            ([tag, accept]) => {
                                // classifyByTag[tag] is a big function that we generate recursively.
                                // As such, we cannot remember which objects are already part of its check.
                                // So remember that classifyByTag[tag] already includes a check for this object.
                                let shouldAddToClassifier = false;
                                if (!classifierByTagIncludesKeys[tag]) {
                                    classifierByTagIncludesKeys[tag] = new Set([
                                        key,
                                    ]);
                                    shouldAddToClassifier = true;
                                } else if (
                                    !classifierByTagIncludesKeys[tag].has(key)
                                ) {
                                    classifierByTagIncludesKeys[tag].add(key);
                                    shouldAddToClassifier = true;
                                }

                                classifyByObjectKey[key][tag] = (obj) => {
                                    if (accept(obj)) {
                                        return group.id;
                                    }
                                };

                                if (shouldAddToClassifier) {
                                    if (!classifyByTag[tag]) {
                                        classifyByTag[tag] = (obj) =>
                                            classifyByObjectKey[key]?.[tag]?.(
                                                obj
                                            );
                                    } else {
                                        const prevClassify = classifyByTag[tag];
                                        classifyByTag[tag] = (obj) =>
                                            classifyByObjectKey[key]?.[tag]?.(
                                                obj
                                            ) ?? prevClassify(obj);
                                    }
                                }

                                retrySeekersForTags.add(tag);
                            }
                        );
                    }
                } else {
                    // No group found. Try to find it through post-grouping.
                    const postGroup = postGrouping?.(object);
                    if (postGroup?.seek) {
                        let groupId: string | undefined;
                        for (const tag of postGroup.seek) {
                            const classifiedGroupId =
                                classifyByTag[tag]?.(object);
                            if (classifiedGroupId) {
                                groupId = classifiedGroupId;
                                break;
                            }
                        }
                        if (groupId) {
                            // Found a postgroup for this object.
                            groupsByKey[key] = groupId;

                            if (!members[groupId].has(key)) {
                                updateMembersOf(groupId);
                                members[groupId].add(key);
                                for (const seekers of Object.values(
                                    seekersByTag
                                )) {
                                    // No longer a seeker!
                                    delete seekers[key];
                                }
                            }
                        } else {
                            for (const tag of postGroup.seek) {
                                if (!seekersByTag[tag]) {
                                    seekersByTag[tag] = { [key]: object };
                                } else {
                                    seekersByTag[tag][key] = object;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (retrySeekersForTags.size > 0) {
            // See if we can find some seekers a group.
            for (const tag of retrySeekersForTags) {
                for (const [key, object] of Object.entries(
                    seekersByTag[tag] ?? {}
                )) {
                    if (groupsByKey[key]) {
                        continue;
                    }
                    const groupId = classifyByTag[tag]?.(object);

                    if (groupId) {
                        // Found a postgroup for this object.
                        groupsByKey[key] = groupId;

                        if (!members[groupId].has(key)) {
                            updateMembersOf(groupId);
                            members[groupId].add(key);
                            for (const seekers of Object.values(seekersByTag)) {
                                // No longer a seeker!
                                delete seekers[key];
                            }
                        }
                    }
                }
            }
        }

        if (members !== initMembers || groups !== initGroups) {
            result = { groups, members };
        }

        return result;
    };
}
