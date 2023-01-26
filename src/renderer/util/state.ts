import { Context, createContext, useCallback, useContext } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { useSubscribedState } from "../hook/subscribed-state";

export type StoreUpdate<T> = T | ((oldValue: T) => T);

export type Store<T> = {
    get(): T;
    set(newValue: StoreUpdate<T>): T;
    subscribe(listener: (value: T) => void): void;
    unsubscribe(listener: (value: T) => void): void;
};

export type UseStore<T, S extends Store<T>> = (() => S) & {
    Context: Context<S>;
};

export type UseStoreValue<T> = {
    (): T;
    <U>(selector: (data: T) => U, deps?: any[]): U;
};

export function transformUseStoreValue<T, R>(
    hook: UseStoreValue<T>,
    transformer: (input: T) => R
): UseStoreValue<R> {
    return ((selector, deps) => {
        return hook((v) => {
            const transformedValue = transformer(v);
            return selector ? selector(transformedValue) : transformedValue;
        }, deps);
    }) as UseStoreValue<R>;
}

export type UseStoreValueGetter<T> = () => () => T;

export function createStore<T>(initialValue: T): Store<T> {
    let value = initialValue;
    let listeners: Array<(value: T) => void> = [];
    return {
        get() {
            return value;
        },
        set(newValue: T | ((oldValue: T) => T)): T {
            const oldValue = value;
            if (typeof newValue === "function") {
                value = (newValue as (oldValue: T) => T)(value);
            } else {
                value = newValue;
            }
            if (oldValue !== value) {
                unstable_batchedUpdates(() => {
                    listeners.forEach((l) => l(value));
                });
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
        if (selector) {
            return useProvidedStoreValue(store, selector, deps);
        } else {
            return useProvidedStoreValue(store);
        }
    };

    const useStoreValueGetter = () => {
        return useStore().get;
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

export function useProvidedStoreValue<T>(store: Store<T>): T;
export function useProvidedStoreValue<T, U>(
    store: Store<T>,
    selector: (data: T) => U,
    deps?: any[]
): U;
export function useProvidedStoreValue<T, U>(
    store: Store<T>,
    selector?: (data: T) => U,
    deps?: any
): T | U {
    const transformValue = useCallback(
        (value: T) => (selector ? selector(value) : value),
        deps ?? []
    );
    return useSubscribedState<T | U>(
        () => transformValue(store.get()),
        (set) => {
            set(transformValue(store.get()));
            const listener = (value: T) => {
                set(transformValue(value));
            };
            store.subscribe(listener);
            return () => {
                store.unsubscribe(listener);
            };
        },
        [store, transformValue]
    );
}
