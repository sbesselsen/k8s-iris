import { app } from "electron";
import * as path from "path";
import { createKvDiskStore, KvDiskStore, KvDiskStoreOptions } from "../kv";

export type PersistentStateManagerOptions = Partial<KvDiskStoreOptions>;

export type PersistentStateManager = KvDiskStore;
export function createPersistentStateManager(
    options: PersistentStateManagerOptions = {}
): PersistentStateManager {
    return createKvDiskStore({
        storageFilePath: path.join(
            app.getPath("userData"),
            "backend",
            "state.json"
        ),
        writeMaxDelayMs: 1000,
        ...options,
    });
}
