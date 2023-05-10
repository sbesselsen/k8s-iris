import { PrefsManager } from ".";
import { ipcHandle, ipcProvideSubscription } from "../../common/ipc/main";

export const wirePrefsManagerIpc = (prefsManager: PrefsManager): void => {
    ipcHandle("prefs:read", ({ key }: { key: string }) =>
        prefsManager.read(key)
    );
    ipcHandle(
        "prefs:write",
        ({ key, value }: { key: string; value: unknown }) =>
            prefsManager.write(key, value)
    );
    ipcHandle("prefs:delete", ({ key }: { key: string }) =>
        prefsManager.delete(key)
    );
    ipcProvideSubscription<{ key: string }, { newValue: unknown }>(
        "prefs:subscribe",
        ({ key }, send) =>
            prefsManager.subscribe(key, (newValue) => {
                send(undefined, { newValue });
            })
    );
};
