import { useCallback, useMemo } from "react";
import { useDialog } from "../hook/dialog";
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

export function useContextLockHelpers(): {
    checkContextLock: () => Promise<boolean>;
} {
    const context = useK8sContext();
    const store = useStore();
    const showDialog = useDialog();

    return useMemo(() => {
        return {
            checkContextLock: async () => {
                const locks = store.get();
                const isClusterLocked = context
                    ? locks[context] ?? autoLockValue(context)
                    : false;

                if (isClusterLocked) {
                    const result = await showDialog({
                        title: "Read-only mode",
                        type: "warning",
                        message: "This cluster is in read-only mode.",
                        detail: "You can only continue after you unlock the cluster.",
                        buttons: [
                            "Continue and Unlock",
                            "Continue Once",
                            "Cancel",
                        ],
                        defaultId: 2,
                    });
                    if (result.response === 1) {
                        // Continue once but don't unlock.
                        return true;
                    }
                    if (result.response === 0) {
                        // Continue and unlock.
                        store.set((oldValue) => ({
                            ...oldValue,
                            [context]: false,
                        }));
                        return true;
                    }
                    // User cancelled.
                    return false;
                }

                return true;
            },
        };
    }, [context, showDialog, store]);
}

export class ContextLockedError extends Error {}

function autoLockValue(context: string): boolean {
    return context.match(/prod/) && !context.match(/non-?prod/);
}
