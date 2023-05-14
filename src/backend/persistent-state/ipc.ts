import { PersistentStateManager } from ".";
import { wireKvDiskStoreIpc } from "../kv/ipc";

export const wirePersistentStateManagerIpc = (
    persistentStateManager: PersistentStateManager
): void => {
    wireKvDiskStoreIpc("persistentState", persistentStateManager);
};
