import { TempDataManager } from ".";
import { wireKvDiskStoreIpc } from "../kv/ipc";

export const wireTempDataManagerIpc = (
    tempDataManager: TempDataManager
): void => {
    wireKvDiskStoreIpc("tempData", tempDataManager);
};
