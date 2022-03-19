import {
    Context,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";

export type StoreUpdate<T> = T | ((oldValue: T) => T);

export type Store<T> = {
    get(): T;
    set(newValue: StoreUpdate<T>): T;
    subscribe(listener: (value: T) => void);
    unsubscribe(listener: (value: T) => void);
};

export type UseStore<T, S extends Store<T>> = (() => S) & {
    Context: Context<S>;
};

export type UseStoreValue<T> = {
    (): T;
    <U>(selector: (data: T) => U, deps?: any[]): U;
};

export type UseStoreValueGetter<T> = () => () => T;

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

export type StoreContextHooks<T, S extends Store<T> = Store<T>> = {
    useStore: UseStore<T, S>;
    useStoreValue: UseStoreValue<T>;
    useStoreValueGetter: UseStoreValueGetter<T>;
};

export function createStoreHooks<T, S extends Store<T>>(
    store: Store<T> & S
): StoreContextHooks<T, S> {
    const StoreContext = createContext(store);

    const useStore = (() => useContext(StoreContext)) as UseStore<T, S>;
    useStore.Context = StoreContext;

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

    const useStoreValueGetter = () => {
        const store = useStore();
        return useCallback(() => store.get(), [store]);
    };

    return {
        useStoreValue,
        useStore,
        useStoreValueGetter,
    };
}

export type StoreComponents<T, S extends Store<T>> = StoreContextHooks<T, S> & {
    store: S & Store<T>;
};

export function create<T>(defaultValue: T): StoreComponents<T, Store<T>> {
    const store = createStore(defaultValue);
    return {
        store,
        ...createStoreHooks(store),
    };
}
