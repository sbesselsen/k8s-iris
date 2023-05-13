import { KvDiskStore } from ".";
import { ipcHandle, ipcProvideSubscription } from "../../common/ipc/main";

export const wireKvDiskStoreIpc = (
    prefix: string,
    kvStore: KvDiskStore
): void => {
    ipcHandle(`${prefix}:read`, ({ key }: { key: string }) =>
        kvStore.read(key)
    );
    ipcHandle(
        `${prefix}:write`,
        ({ key, value }: { key: string; value: unknown }) =>
            kvStore.write(key, value)
    );
    ipcHandle(`${prefix}:delete`, ({ key }: { key: string }) =>
        kvStore.delete(key)
    );
    ipcProvideSubscription<{ key: string }, { newValue: unknown }>(
        `${prefix}:subscribe`,
        ({ key }, send) =>
            kvStore.subscribe(key, (newValue) => {
                send(undefined, { newValue });
            })
    );
};
