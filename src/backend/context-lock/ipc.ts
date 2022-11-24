import { ContextLockManager } from "./index";
import { ipcHandle, ipcProvideSubscription } from "../../common/ipc/main";

export const wireContextLockIpc = (
    contextLockManager: ContextLockManager
): void => {
    ipcHandle(
        "contextLock:set",
        ({ context, locked }: { context: string; locked: boolean }) => {
            contextLockManager.set(context, locked);
        }
    );
    ipcProvideSubscription<{ context: string }, { locked: boolean }>(
        "contextLock:watch",
        ({ context }, send) => {
            return contextLockManager.watch(context, send);
        }
    );
};
