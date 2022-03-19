import {
    createStore,
    Store,
    StoreUpdate,
    UseStore,
    UseStoreValue,
    UseStoreValueGetter,
} from "./state";

export type HistoryOptions = {
    maxSize?: number;
    maxOverflow?: number;
};

const defaultOptions: HistoryOptions = {
    maxSize: 100,
    maxOverflow: 10,
};

export type HistoryOf<T> = {
    values: T[];
    currentIndex: number;
    size: number;
};

export type HistoryStore<T> = Store<HistoryOf<T>> & {
    getCurrent(): T;
    setCurrent(newValue: StoreUpdate<T>, replace?: boolean): T;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): T;
    goForward(): T;
};

export function createHistoryStore<T>(
    initialValue: T,
    options: HistoryOptions = {}
): HistoryStore<T> {
    const { maxSize, maxOverflow } = { ...defaultOptions, ...options };

    const baseStore: Store<HistoryOf<T>> = createStore({
        values: [initialValue],
        currentIndex: 0,
        size: 1,
    });

    return {
        get() {
            return baseStore.get();
        },
        set(newValue) {
            return baseStore.set(newValue);
        },
        subscribe(listener) {
            baseStore.subscribe(listener);
        },
        unsubscribe(listener) {
            baseStore.unsubscribe(listener);
        },
        getCurrent() {
            const history = baseStore.get();
            return history.values[history.currentIndex];
        },
        setCurrent(newValue, replace = false) {
            const history = baseStore.get();
            const oldValue = history.values[history.currentIndex];
            const value =
                typeof newValue === "function"
                    ? (newValue as (oldValue: T) => T)(oldValue)
                    : newValue;
            if (value === oldValue) {
                return value;
            }

            const newHistory = { ...history, values: [...history.values] };

            if (replace) {
                newHistory.values[newHistory.currentIndex] = value;
            } else {
                const newIndex = newHistory.currentIndex + 1;
                newHistory.values[newIndex] = value;
                newHistory.currentIndex = newIndex;
                newHistory.size = newIndex + 1;
                if (newHistory.size >= maxSize + maxOverflow) {
                    // Clean up history buffer so it does not grow unchecked.
                    // The right way to do this is probably with a ringbuffer or whatever,
                    // but I can't figure it out.
                    const numValuesToDrop = newHistory.values.length - maxSize;
                    newHistory.values =
                        newHistory.values.slice(numValuesToDrop);
                    newHistory.currentIndex -= numValuesToDrop;
                    newHistory.size -= numValuesToDrop;
                }
            }

            const setNewHistory = baseStore.set(newHistory);
            return setNewHistory.values[setNewHistory.currentIndex];
        },
        canGoBack() {
            return baseStore.get().currentIndex > 0;
        },
        canGoForward() {
            const history = baseStore.get();
            return history.currentIndex < history.size - 1;
        },
        goBack() {
            const newHistory = baseStore.set((history) =>
                history.currentIndex === 0
                    ? history
                    : {
                          ...history,
                          currentIndex: history.currentIndex - 1,
                      }
            );
            return newHistory.values[newHistory.currentIndex];
        },
        goForward() {
            const newHistory = baseStore.set((history) =>
                history.currentIndex >= history.size - 1
                    ? history
                    : {
                          ...history,
                          currentIndex: history.currentIndex + 1,
                      }
            );
            return newHistory.values[newHistory.currentIndex];
        },
    };
}

export type HistoryInfo = {
    canGoBack: boolean;
    canGoForward: boolean;
};

export type HistoryControls<T> = {
    goBack(): T;
    goForward(): T;
};

export const useCurrentValue =
    <T>(useStoreValueHook: UseStoreValue<HistoryOf<T>>): UseStoreValue<T> =>
    (selector = undefined, deps = []) =>
        useStoreValueHook((history) => {
            const value = history.values[history.currentIndex];
            return selector ? selector(value) : value;
        }, deps);

export const useCurrentValueGetter =
    <T>(
        useStoreHook: UseStore<HistoryOf<T>, HistoryStore<T>>
    ): UseStoreValueGetter<T> =>
    () => {
        const store = useStoreHook();
        return () => store.getCurrent();
    };

export const useHistoryInfo = <T>(
    useStoreValueHook: UseStoreValue<HistoryOf<T>>
): HistoryInfo => {
    const history = useStoreValueHook();
    return {
        canGoBack: history.currentIndex > 0,
        canGoForward: history.currentIndex < history.size - 1,
    };
};

export const useHistoryControls = <T>(
    useStoreHook: UseStore<HistoryOf<T>, HistoryStore<T>>
): HistoryControls<T> => {
    const store = useStoreHook();
    return {
        goBack: () => store.goBack(),
        goForward: () => store.goForward(),
    };
};
