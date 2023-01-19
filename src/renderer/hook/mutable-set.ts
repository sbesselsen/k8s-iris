import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";

export type MutableSetConstructorOptions<T> = {
    key: (obj: T) => string;
};

export type MutableSetMutation<T> = {
    key: string;
    value: T | undefined;
    prevValue: T | undefined;
};

export type MutableSetSubscriber<T> = (
    set: MutableSet<T>,
    mutations: Record<string, MutableSetMutation<T>>
) => void;

export type MutableSet<T> = {
    put: (...obj: T[]) => MutableSet<T>;
    delete: (...obj: T[]) => MutableSet<T>;
    clear: () => MutableSet<T>;
    has: (obj: T) => boolean;
    hasKey: (key: string) => boolean;
    get: (id: string) => T;
    key: (obj: T) => string;
    keys: () => string[];
    values: () => T[];
    entries: () => Array<[string, T]>;
    size: () => number;
    subscribe: (f: MutableSetSubscriber<T>) => { stop: () => void };
};

class MutableSetImpl<T> implements MutableSet<T> {
    private backingMap: Record<string, T>;
    private keyFunction: (obj: T) => string;
    private subscribers: Array<MutableSetSubscriber<T>>;

    constructor(options: MutableSetConstructorOptions<T>) {
        this.backingMap = {};
        this.keyFunction = options.key;
        this.subscribers = [];
    }
    put(...obj: T[]) {
        const mutations = obj
            .map((o) => {
                const key = this.keyFunction(o);
                return {
                    key,
                    value: o,
                    prevValue: this.backingMap[key],
                };
            })
            .filter(({ value, prevValue }) => value !== prevValue);
        if (mutations.length === 0) {
            return this;
        }
        for (const mutation of mutations) {
            this.backingMap[mutation.key] = mutation.value;
        }
        this.notifySubscribers(mutations);
        return this;
    }
    delete(...obj: T[]) {
        const keys = obj
            .map(this.keyFunction)
            .filter((key) => key in this.backingMap);
        if (keys.length === 0) {
            return this;
        }
        const mutations: Array<MutableSetMutation<T>> = keys.map((key) => ({
            key,
            value: undefined,
            prevValue: this.backingMap[key],
        }));
        for (const key of keys) {
            delete this.backingMap[key];
        }
        this.notifySubscribers(mutations);
        return this;
    }
    clear() {
        if (this.subscribers.length === 0) {
            this.backingMap = {};
            return this;
        }
        const mutations: Array<MutableSetMutation<T>> = Object.entries(
            this.backingMap
        ).map(([key, obj]) => ({ key, value: undefined, prevValue: obj }));
        this.backingMap = {};
        this.notifySubscribers(mutations);
        return this;
    }
    has(obj: T) {
        return this.keyFunction(obj) in this.backingMap;
    }
    hasKey(key: string) {
        return key in this.backingMap;
    }
    get(key: string) {
        const value = this.backingMap[key];
        if (value === undefined) {
            throw new Error("Undefined key in MutableSet: " + key);
        }
        return value;
    }
    key(obj: T) {
        return this.keyFunction(obj);
    }
    keys() {
        return Object.keys(this.backingMap);
    }
    values() {
        return Object.values(this.backingMap);
    }
    entries() {
        return Object.entries(this.backingMap);
    }
    size() {
        return Object.keys(this.backingMap).length;
    }
    subscribe(f: MutableSetSubscriber<T>) {
        let isSubscribed = true;
        const subscriber: MutableSetSubscriber<T> = (map, mutations) => {
            if (isSubscribed) {
                f(map, mutations);
            }
        };
        this.subscribers.push(subscriber);
        return {
            stop: () => {
                isSubscribed = false;
                this.subscribers = this.subscribers.filter(
                    (s) => s !== subscriber
                );
            },
        };
    }
    private notifySubscribers(mutations: Array<MutableSetMutation<T>>) {
        const keyedMutations: Record<string, MutableSetMutation<T>> = {};
        for (const mutation of mutations) {
            keyedMutations[mutation.key] = mutation;
        }
        unstable_batchedUpdates(() => {
            this.subscribers.forEach((s) => s(this, keyedMutations));
        });
    }
}

export type CreateMutableSetOptions<T> = MutableSetConstructorOptions<T> & {
    items?: () => T[];
};

export function createMutableSet<T>(
    options: CreateMutableSetOptions<T>
): MutableSet<T> {
    const { items, ...rest } = options;
    const set = new MutableSetImpl(rest);
    if (items) {
        set.put(...items());
    }
    return set;
}

export function useMutableSetKeys<T>(
    set: MutableSet<T>,
    filter?: ((obj: T) => boolean) | undefined | null,
    sortCompare?: ((obj1: T, obj2: T) => number) | undefined | null,
    deps: any[] = []
): string[] {
    const calculateIds = useCallback(() => {
        let entries = set.entries();
        if (filter) {
            entries = entries.filter(([, v]) => filter(v));
        }
        if (sortCompare) {
            entries.sort(([, v1], [, v2]) => sortCompare(v1, v2));
        }
        return entries.map(([k]) => k);
    }, [set, ...deps]);

    const [ids, setIds] = useState(calculateIds);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { stop } = set.subscribe((_set, mutations) => {
            function shouldRecalculate() {
                if (!filter && !sortCompare) {
                    // Recalculate only if items are added or removed.
                    return Object.values(mutations).some(
                        ({ value, prevValue }) =>
                            value === undefined || prevValue === undefined
                    );
                }
                if (!filter) {
                    // We have to recalculate because items may be sorted differently.
                    return true;
                }
                // We have a filter and we have a sort. Recalculate if some incoming or outgoing items are covered by the filter.
                return Object.values(mutations).some(
                    ({ value, prevValue }) =>
                        (value && filter(value)) ||
                        (prevValue && filter(prevValue))
                );
            }
            if (shouldRecalculate()) {
                setIds((oldIds) => {
                    const newIds = calculateIds();
                    if (
                        oldIds.length === newIds.length &&
                        oldIds.every((v, i) => newIds[i] === v)
                    ) {
                        return oldIds;
                    }
                    return newIds;
                });
            }
        });
        return stop;
    }, [set, setIds, ...deps]);

    return ids;
}

export function useMutableSetValue<T>(
    set: MutableSet<T>,
    key: string
): T | undefined;
export function useMutableSetValue<T, U>(
    set: MutableSet<T>,
    key: string,
    map: (obj: T) => U,
    deps: any[]
): U | undefined;
export function useMutableSetValue<T, U>(
    set: MutableSet<T>,
    key: string,
    map?: (obj: T) => U,
    deps: any[] = []
): T | U | undefined {
    const memoMap = useMemo(() => map, deps);
    const currentValueRef = useRef<T | U | undefined>();

    const calculateValue = useCallback(() => {
        let value: T | U | undefined = set.hasKey(key)
            ? set.get(key)
            : undefined;
        if (value !== undefined && memoMap) {
            value = memoMap(value);
        }
        return value;
    }, [key, memoMap, set]);

    const [value, setValue] = useState<T | U | undefined>(calculateValue);
    currentValueRef.current = value;

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { stop } = set.subscribe((_set, mutations) => {
            if (mutations[key]) {
                const newValue = calculateValue();
                if (newValue !== currentValueRef.current) {
                    setValue(newValue);
                }
            }
        });
        return stop;
    }, [calculateValue, currentValueRef, key, set, setValue]);

    return value;
}

export function useMutableSet<T, U>(
    set: MutableSet<T>,
    map: (set: MutableSet<T>) => U,
    deps: any[]
): U {
    const memoMap = useMemo(() => map, deps);
    const currentValueRef = useRef<U | undefined>();

    const [value, setValue] = useState<U>(() => memoMap(set));
    currentValueRef.current = value;

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { stop } = set.subscribe((_set, mutations) => {
            const newValue = memoMap(set);
            if (newValue !== currentValueRef.current) {
                setValue(newValue);
            }
        });
        return stop;
    }, [memoMap, currentValueRef, set, setValue]);

    return value;
}
