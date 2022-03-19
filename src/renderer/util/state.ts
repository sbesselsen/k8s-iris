import { Context, createContext, useContext, useEffect, useState } from "react";

export type StoreUpdate<T> = T | ((oldValue: T) => T);

export type Store<T> = {
    get(): T;
    set(newValue: StoreUpdate<T>): T;
    subscribe(listener: (value: T) => void);
    unsubscribe(listener: (value: T) => void);
};

export type UseStore<T> = () => Store<T>;

export type UseStoreValue<T> = {
    (): T;
    <U>(selector: (data: T) => U, deps?: any[]): U;
};

export function createStore<T>(initialValue: T): Store<T> {
    let value = initialValue;
    let listeners: Array<(value: T) => void> = [];
    return {
        get() {
            return value;
        },
        set(newValue: T | ((oldValue: T) => T)): T {
            let oldValue = value;
            if (typeof newValue === "function") {
                value = (newValue as (oldValue: T) => T)(value);
            } else {
                value = newValue;
            }
            if (oldValue !== value) {
                listeners.forEach((l) => l(value));
            }
            return value;
        },
        subscribe(listener: (value: T) => void) {
            listeners.push(listener);
        },
        unsubscribe(listener: (value: T) => void) {
            listeners = listeners.filter((l) => l !== listener);
        },
    };
}

export function createStoreContext<T>(store: Store<T>): Context<Store<T>> {
    return createContext(store);
}

export type StoreContextHooks<T> = {
    useStoreValue: UseStoreValue<T>;
    useStore: UseStore<T>;
    useSetStoreValue: (newValue: StoreUpdate<T>) => T;
};

export function createStoreContextHooks<T>(
    StoreContext: Context<Store<T>>
): StoreContextHooks<T> {
    const useStore: UseStore<T> = () => useContext(StoreContext);

    const useStoreValue: UseStoreValue<T> = <U>(
        selector?: (data: T) => U,
        deps?: any[]
    ) => {
        const store = useStore();
        const storeValue = store.get();
        const [localValue, setLocalValue] = useState<T | U>(
            selector ? selector(storeValue) : storeValue
        );

        useEffect(() => {
            const listener = (value: T) => {
                const newValue = selector ? selector(value) : value;
                setLocalValue(newValue);
            };
            store.subscribe(listener);
            return () => {
                store.unsubscribe(listener);
            };
        }, [setLocalValue, store, ...(deps ?? [])]);

        return localValue;
    };

    const useSetStoreValue = (newValue: StoreUpdate<T>) =>
        useStore().set(newValue);

    return {
        useStoreValue,
        useStore,
        useSetStoreValue,
    };
}

export type StoreComponents<T> = StoreContextHooks<T> & {
    rootStore: Store<T>;
    Context: Context<Store<T>>;
};

export function create<T>(defaultValue: T): StoreComponents<T> {
    const rootStore = createStore(defaultValue);
    const Context = createStoreContext(rootStore);
    return {
        ...createStoreContextHooks(Context),
        rootStore,
        Context,
    };
}

export type ConnectedStore<T> = Store<T> & { disconnect(): void };

export function connectedStore<T, U>(
    parentStore: Store<T>,
    get: (parentValue: T) => U,
    set: (parentValue: T, newValue: (oldValue: U) => U) => T
): ConnectedStore<U> {
    const store = createStore(get(parentStore.get()));

    const innerSet = store.set.bind(store);
    store.set = (newValue) =>
        get(
            parentStore.set((oldParentValue) =>
                set(
                    oldParentValue,
                    (typeof newValue === "function"
                        ? newValue
                        : () => newValue) as (oldValue: U) => U
                )
            )
        );

    const listener = (newParentValue: T) => {
        innerSet(get(newParentValue));
    };
    parentStore.subscribe(listener);

    return {
        ...store,
        disconnect() {
            parentStore.unsubscribe(listener);
        },
    };
}
