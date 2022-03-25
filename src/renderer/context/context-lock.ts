import { useCallback } from "react";
import { create, StoreUpdate } from "../util/state";
import { useK8sContext } from "./k8s-context";

const { useStore, useStoreValue } = create({} as Record<string, boolean>);

export function useContextLock(): boolean {
    const context = useK8sContext();

    return useStoreValue(
        (locks) => (context ? locks[context] ?? autoLockValue(context) : false),
        [context]
    );
}

export function useContextLockSetter(): (
    lockValue: StoreUpdate<boolean>
) => void {
    const context = useK8sContext();
    const store = useStore();
    return useCallback(
        (lockValue) => {
            if (!context) {
                return;
            }
            store.set((locks) => {
                const oldValue = locks[context] ?? autoLockValue(context);
                const newValue =
                    typeof lockValue === "boolean"
                        ? lockValue
                        : lockValue(oldValue);
                return { ...locks, [context]: newValue };
            });
        },
        [context, store]
    );
}

export class ContextLockedError extends Error {}

function autoLockValue(context: string): boolean {
    return context.match(/prod/) && !context.match(/non-?prod/);
}
