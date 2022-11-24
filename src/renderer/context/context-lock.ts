import { useCallback, useEffect, useMemo } from "react";
import { useDialog } from "../hook/dialog";
import { useIpcCall } from "../hook/ipc";
import { create, StoreUpdate } from "../util/state";
import { useK8sContext } from "./k8s-context";

const { useStore, useStoreValue } = create({ locks: {}, ipcWatchers: {} } as {
    locks: Record<string, boolean>;
    ipcWatchers: Record<string, { stop: () => void }>;
});

function useContextLockIpcWatch(context: string) {
    const store = useStore();
    const ipcWatch = useIpcCall((ipc) => ipc.contextLock.watch);
    useEffect(() => {
        store.set((value) => {
            if (value.ipcWatchers[context]) {
                // A watcher already exists.
                return value;
            }
            // Watch for changes via IPC and apply them to our store.
            const { stop } = ipcWatch({ context }, (_error, message) => {
                if (message) {
                    store.set((value) => {
                        if (value.locks[context] === message.locked) {
                            return value;
                        }
                        return {
                            ...value,
                            locks: {
                                ...value.locks,
                                [context]: message.locked,
                            },
                        };
                    });
                }
            });
            return {
                ...value,
                ipcWatchers: {
                    ...value.ipcWatchers,
                    [context]: {
                        stop,
                    },
                },
            };
        });
    }, [context, store]);
}

export function useContextLock(): boolean {
    const context = useK8sContext();
    useContextLockIpcWatch(context);
    return useStoreValue(({ locks }) => locks[context] ?? true, [context]);
}

export function useContextLockGetter(): () => boolean {
    const context = useK8sContext();
    useContextLockIpcWatch(context);
    const store = useStore();
    return useCallback(
        () => lockValue(store.get().locks, context),
        [context, store]
    );
}

export function useContextLockSetter(): (
    lockValue: StoreUpdate<boolean>
) => void {
    const context = useK8sContext();
    const getLock = useContextLockGetter();
    const setIpcLock = useIpcCall((ipc) => ipc.contextLock.set);

    const store = useStore();
    return useCallback(
        (newLockValue) => {
            if (!context) {
                return;
            }
            const newStoreValue = store.set((storeValue) => {
                const oldValue = lockValue(storeValue.locks, context);
                const newValue =
                    typeof newLockValue === "boolean"
                        ? newLockValue
                        : newLockValue(oldValue);
                if (newValue === oldValue) {
                    return storeValue;
                }
                return {
                    ...storeValue,
                    locks: { ...storeValue.locks, [context]: newValue },
                };
            });
            setIpcLock({
                context,
                locked: lockValue(newStoreValue.locks, context),
            });
        },
        [context, getLock, setIpcLock, store]
    );
}

export function useContextLockHelpers(): {
    checkContextLock: () => Promise<boolean>;
} {
    const context = useK8sContext();
    const showDialog = useDialog();
    const getLock = useContextLockGetter();
    const setLock = useContextLockSetter();

    return useMemo(() => {
        return {
            checkContextLock: async () => {
                const isClusterLocked = getLock();

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
                        setLock(false);
                        return true;
                    }
                    // User cancelled.
                    return false;
                }

                return true;
            },
        };
    }, [context, getLock, setLock, showDialog]);
}

export class ContextLockedError extends Error {}

function lockValue(
    locks: Record<string, boolean>,
    context: string | null | undefined
): boolean {
    return context ? locks[context] ?? true : false;
}
