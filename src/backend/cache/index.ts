import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

export type CacheManagerOptions = {
    cacheFilePath?: string;
};

export type CacheManager = {
    read(key: string | string[]): Promise<string | null>;
    write(
        key: string | string[],
        value: string | null,
        ttl?: number | undefined | null
    ): void;
};

export function createCacheManager(
    options: CacheManagerOptions = {}
): CacheManager {
    // TODO: use sqlite3 or whatever. But this is good enough for now and has no native dependencies.
    const defaultCacheFilePath = path.join(app.getPath("userData"), "cache.db");

    const { cacheFilePath = defaultCacheFilePath } = options;

    const dir = path.dirname(cacheFilePath);
    if (!fs.existsSync(dir)) {
        console.log("Creating storage dir", dir);
        fs.mkdirSync(dir, {
            recursive: true,
        });
    }

    function keyString(key: string | string[]): string {
        return JSON.stringify(Array.isArray(key) ? key : [key]);
    }

    let cache: Record<string, { expires?: number; data: string }> = {};

    // Load cache.
    if (fs.existsSync(cacheFilePath)) {
        let data = "{}";
        try {
            data = fs.readFileSync(cacheFilePath, "utf8");
        } catch (e) {
            console.error(`Error reading cache file at ${cacheFilePath}: ${e}`);
        }
        try {
            cache = JSON.parse(data);
        } catch (e) {
            console.error(`Error parsing cache file at ${cacheFilePath}: ${e}`);
        }
    }

    let isDirty = false;
    let isStoring = false;
    setInterval(async () => {
        // Store (if dirty) every 10 seconds.
        if (isDirty && !isStoring) {
            isStoring = true;
            isDirty = false;
            console.log("Writing cache to disk");
            try {
                await fs.promises.writeFile(
                    cacheFilePath,
                    JSON.stringify(cache),
                    {
                        encoding: "utf8",
                    }
                );
            } catch (e) {
                console.error(`Error writing cache: ${e}`);
            }
            isStoring = false;
        }
    }, 10000);

    // Remove expired entries from the cache.
    const ts = new Date().getTime();
    for (const [k, v] of Object.entries(cache)) {
        if (v.expires !== undefined && v.expires <= ts) {
            delete cache[k];
            isDirty = true;
        }
    }

    return {
        async read(key) {
            const k = keyString(key);
            const entry = cache[k];
            if (!entry) {
                return null;
            }
            const ts = new Date().getTime();
            if (entry.expires !== undefined && entry.expires <= ts) {
                delete cache[k];
                isDirty = true;
                return null;
            }
            return entry.data;
        },
        write(key, value, ttl) {
            const k = keyString(key);
            if (value === null) {
                if (cache[k]) {
                    delete cache[k];
                    isDirty = true;
                }
            } else {
                cache[k] = {
                    data: value,
                    ...(typeof ttl === "number"
                        ? { expires: new Date().getTime() + ttl * 1000 }
                        : {}),
                };
                isDirty = true;
            }
        },
    };
}
