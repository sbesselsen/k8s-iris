import { CacheManager } from ".";
import { ipcHandle } from "../../common/ipc/main";

export const wireCacheManagerIpc = (cacheManager: CacheManager): void => {
    ipcHandle("cache:read", ({ key }: { key: string | string[] }) =>
        cacheManager.read(key)
    );
    ipcHandle(
        "cache:write",
        ({
            key,
            value,
            ttl,
        }: {
            key: string | string[];
            value: string | null;
            ttl: number | null;
        }) => cacheManager.write(key, value, ttl)
    );
};
