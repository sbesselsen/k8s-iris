import { app } from "electron";
import * as path from "path";
import { createKvDiskStore, KvDiskStore, KvDiskStoreOptions } from "../kv";

export type PrefsManagerOptions = Partial<KvDiskStoreOptions>;

export type PrefsManager = KvDiskStore;
export function createPrefsManager(
    options: PrefsManagerOptions = {}
): PrefsManager {
    return createKvDiskStore({
        storageFilePath: path.join(app.getPath("userData"), "preferences.json"),
        writeMaxDelayMs: 0,
        ...options,
    });
}
