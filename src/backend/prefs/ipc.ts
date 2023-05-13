import { PrefsManager } from ".";
import { wireKvDiskStoreIpc } from "../kv/ipc";

export const wirePrefsManagerIpc = (prefsManager: PrefsManager): void => {
    wireKvDiskStoreIpc("prefs", prefsManager);
};
