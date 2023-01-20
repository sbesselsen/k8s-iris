import {
    MutableRefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

export type SetSubscribedState<T> = (
    newValue: T | ((oldValue: T) => T)
) => void;

export function useSubscribedState<T>(
    initialValue: T | (() => T),
    subscribe: (setValue: SetSubscribedState<T>) => () => void,
    deps: any[] = []
): T {
    const memoSubscribe = useCallback(subscribe, deps);

    const [, setRenderIndex] = useState(0);
    const currentValueRef = useRef() as MutableRefObject<{ value: T }>;
    if (currentValueRef.current === undefined) {
        currentValueRef.current = {
            value:
                typeof initialValue === "function"
                    ? (initialValue as () => T)()
                    : initialValue,
        };
    }

    useEffect(() => {
        let subscribed = true;
        const unsubscribe = memoSubscribe((newValue) => {
            if (!subscribed) {
                return false;
            }
            const updatedValue =
                typeof newValue === "function"
                    ? (newValue as (oldValue: T) => T)(
                          currentValueRef.current.value
                      )
                    : newValue;
            if (newValue !== currentValueRef.current.value) {
                currentValueRef.current.value = updatedValue;
                setRenderIndex((i) => i + 1);
            }
        });
        return () => {
            subscribed = false;
            unsubscribe();
        };
    }, [memoSubscribe, currentValueRef, setRenderIndex]);

    return currentValueRef.current.value;
}
