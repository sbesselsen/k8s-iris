import React, {
    Context,
    createContext,
    createElement,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

export type UseStore<T> = () => Store<T>;

export type UseStoreValue<T> = {
    (): T;
    <U>(selector: (data: T) => U): U;
};

export type Store<T> = {
    get(): T;
    set(newValue: T | ((oldValue: T) => T)): T;
    subscribe(listener: (value: T) => void);
    unsubscribe(listener: (value: T) => void);
};

export type InternalStore<T> = Store<T> & {
    setReactContext(context: Context<Store<T>>): void;
    getReactContext(): Context<Store<T>>;
};

function createStore<T>(initialValue: T): InternalStore<T> {
    let value = initialValue;
    let listeners: Array<(value: T) => void> = [];
    let context: Context<Store<T>>;
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
        getReactContext(): Context<Store<T>> {
            return context;
        },
        setReactContext(ctx: Context<Store<T>>) {
            context = ctx;
        },
    };
}

export function create<T>(
    defaultValue: T
): [UseStore<T>, UseStoreValue<T>, Store<T>] {
    const store = createStore(defaultValue);
    const StoreContext = createContext<Store<T>>(store);
    store.setReactContext(StoreContext);

    const useStore: UseStore<T> = (): Store<T> => {
        return useContext(StoreContext);
    };

    const useStoreValue: UseStoreValue<T> = <U>(selector?: (data: T) => U) => {
        const store = useStore();
        const value = store.get();

        const localValueRef = useRef<T | U>();
        localValueRef.current = selector ? selector(value) : value;

        const [_, setRenderTrigger] = useState(0);

        useEffect(() => {
            const listener = (value: T) => {
                const newValue = selector ? selector(value) : value;
                if (newValue !== localValueRef.current) {
                    // Time to update this component.
                    localValueRef.current = newValue;
                    setRenderTrigger((t) => t + 1);
                }
            };
            store.subscribe(listener);
            return () => {
                store.unsubscribe(listener);
            };
        }, [selector, localValueRef, store, setRenderTrigger]);

        return localValueRef.current;
    };

    return [useStore, useStoreValue, store];
}

export function useContextStore<T>(store: Store<T>): [Store<T>, React.FC] {
    const ref = useRef<[Store<T>, React.FC]>();
    if (!ref.current) {
        const contextStore = createStore(store.get());
        const StoreProvider: React.FC = ({ children }) => {
            return createElement(
                (store as InternalStore<T>).getReactContext().Provider,
                { value: contextStore },
                children
            );
        };
        return [contextStore, StoreProvider];
    }
}
