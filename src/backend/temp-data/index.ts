import { app } from "electron";
import * as path from "path";
import { createKvDiskStore, KvDiskStore, KvDiskStoreOptions } from "../kv";

export type TempDataManagerOptions = Partial<KvDiskStoreOptions>;

export type TempDataManager = KvDiskStore;
export function createTempDataManager(
    options: TempDataManagerOptions = {}
): TempDataManager {
    return createKvDiskStore({
        storageFilePath: path.join(app.getPath("userData"), "temp.json"),
        writeMaxDelayMs: 10000,
        ...options,
    });
}
