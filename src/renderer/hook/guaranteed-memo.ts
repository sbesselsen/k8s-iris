import { useRef } from "react";

/**
 * Works just like useMemo, but actually guarantees that it will keep the value until the deps change.
 */
export function useGuaranteedMemo<T>(value: () => T, deps: any[]): T {
    const valueRef = useRef<T>();
    const depsRef = useRef<any[]>(deps);
    if (valueRef.current === undefined) {
        valueRef.current = value();
    } else if (
        deps.length !== depsRef.current.length ||
        !deps.every((v, i) => depsRef.current[i] === v)
    ) {
        depsRef.current = deps;
        valueRef.current = value();
    }
    return valueRef.current;
}
