export type Group<T> = T & {
    id: string;
};

export type Grouping<T, U> = (object: T) => Group<U> | null;
export type PostGrouping<T> = (
    object: T
) =>
    | { accept: Record<string, (object: T) => boolean> }
    | { seek: string[] }
    | null;

export type GroupingResult<U> = {
    groups: Record<string, Group<U>>;
    objectKeysByGroup: Record<string, Set<string>>;
};

export type GroupsCalculator<T, U> = {
    apply: (objects: Record<string, T | undefined>) => void;
    get: () => GroupingResult<U>;
};

const noPostGrouping: PostGrouping<any> = () => null;

export function createGroupsCalculator<T, U>(
    grouping: Grouping<T, U>,
    postGrouping: PostGrouping<T> = noPostGrouping
): GroupsCalculator<T, U> {
    let result: GroupingResult<U> = {
        groups: {},
        objectKeysByGroup: {},
    };
    const groupKeysByObjectKey: Record<string, string> = {};

    function removeObjectFromGroup(objectKey: string) {
        if (!groupKeysByObjectKey[objectKey]) {
            return;
        }
        const groupId = groupKeysByObjectKey[objectKey];
        delete groupKeysByObjectKey[objectKey];
        result = {
            ...result,
            objectKeysByGroup: {
                ...result.objectKeysByGroup,
                [groupId]: new Set(
                    [...result.objectKeysByGroup[groupId]].filter(
                        (k) => k !== objectKey
                    )
                ),
            },
        };
        if (result.objectKeysByGroup[groupId].size === 0) {
            // Remove the entire group if it is now empty.
            const newGroups = { ...result.groups };
            delete newGroups[groupId];
            const newObjectKeysByGroup = {
                ...result.objectKeysByGroup,
            };
            delete newObjectKeysByGroup[groupId];
            result = {
                ...result,
                groups: newGroups,
                objectKeysByGroup: newObjectKeysByGroup,
            };
        }
    }

    function addObjectToGroup(objectKey: string, group: Group<U>) {
        groupKeysByObjectKey[objectKey] = group.id;
        if (!result.groups[group.id]) {
            // New group found; add it.
            result = {
                ...result,
                groups: {
                    ...result.groups,
                    [group.id]: group,
                },
                objectKeysByGroup: {
                    ...result.objectKeysByGroup,
                    [group.id]: new Set(),
                },
            };
        }
        if (!result.objectKeysByGroup[group.id].has(objectKey)) {
            // Add object to group.
            result = {
                ...result,
                objectKeysByGroup: {
                    ...result.objectKeysByGroup,
                    [group.id]: new Set([
                        ...result.objectKeysByGroup[group.id],
                        objectKey,
                    ]),
                },
            };
        }
    }

    return {
        apply(objects) {
            for (const [objectKey, object] of Object.entries(objects)) {
                if (object === undefined) {
                    removeObjectFromGroup(objectKey);
                } else {
                    const group = grouping(object);
                    if (group) {
                        if (groupKeysByObjectKey[objectKey] !== group.id) {
                            // The grouping changed.
                            removeObjectFromGroup(objectKey);
                            addObjectToGroup(objectKey, group);
                        }
                    } else {
                        removeObjectFromGroup(objectKey);
                    }
                }
            }
        },
        get() {
            return result;
        },
    };
}

