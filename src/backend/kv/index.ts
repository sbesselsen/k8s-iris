import * as fs from "fs";
import * as path from "path";
import { coalesce } from "../../common/util/async";
import { deepEqual } from "../../common/util/deep-equal";

export type KvDiskStoreOptions = {
    storageFilePath: string;
    writeMaxDelayMs?: number;
};

export type KvDiskStore = {
    read(key: string): Promise<undefined | unknown>;
    write(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    subscribe(
        key: string,
        onChange: (newValue: undefined | unknown) => void
    ): { stop(): void };
};

export function createKvDiskStore(options: KvDiskStoreOptions): KvDiskStore {
    const { storageFilePath, writeMaxDelayMs = 0 } = options;

    const dir = path.dirname(storageFilePath);
    if (!fs.existsSync(dir)) {
        console.log("Creating KV storage dir", dir);
        fs.mkdirSync(dir, {
            recursive: true,
        });
    }

    let values: Record<string, unknown> = {};
    const subscribers: Record<string, Array<(newValue: unknown) => void>> = {};

    // Load data.
    function loadData() {
        if (fs.existsSync(storageFilePath)) {
            console.log("Read KV", storageFilePath);

            let data = "{}";
            try {
                data = fs.readFileSync(storageFilePath, "utf8");
            } catch (e) {
                console.error(
                    `Error reading KV file at ${storageFilePath}: ${e}`
                );
            }
            try {
                values = JSON.parse(data);
            } catch (e) {
                console.error(
                    `Error parsing KV file at ${storageFilePath}: ${e}`
                );
            }
        }
    }
    loadData();

    let hasChangeWatch = false;
    let isWriting = false;
    function watchForChanges() {
        if (hasChangeWatch) {
            return;
        }
        if (!fs.existsSync(storageFilePath)) {
            return;
        }
        hasChangeWatch = true;
        fs.watch(storageFilePath, null, (eventType) => {
            if (isWriting) {
                // Do not respond to our own writes.
                return;
            }
            if (eventType !== "change") {
                return;
            }
            const prevValues = values;

            loadData();

            // Notify subscribers if keys have changed.
            for (const [k, v] of Object.entries(values)) {
                if (!deepEqual(v, prevValues[k])) {
                    // Value has changed.
                    subscribers[k]?.forEach((s) => s(v));
                }
            }
            for (const k of Object.keys(prevValues)) {
                if (!(k in values)) {
                    // Value has been deleted.
                    subscribers[k]?.forEach((s) => s(undefined));
                }
            }
        });
    }
    watchForChanges();

    const commit = coalesce(() => {
        // Commit data synchronously to prevent race conditions.
        console.log("Write KV", storageFilePath);
        isWriting = true;
        fs.writeFileSync(
            storageFilePath,
            JSON.stringify(values, undefined, "  ")
        );
        isWriting = false;

        // Create a change watcher if we don't have one already (if the file didnt' exist before this write).
        watchForChanges();
    }, Math.max(0, writeMaxDelayMs));

    return {
        async read(key) {
            return values[key];
        },
        async write(key, value) {
            if (values[key] === value) {
                return;
            }
            values[key] = value;
            subscribers[key]?.forEach((s) => s(value));
            setTimeout(commit, 0);
        },
        async delete(key) {
            if (!(key in values)) {
                return;
            }
            delete values[key];
            subscribers[key]?.forEach((s) => s(undefined));
            setTimeout(commit, 0);
        },
        subscribe(key, onChange) {
            if (!subscribers[key]) {
                subscribers[key] = [];
            }
            subscribers[key].push(onChange);
            onChange(values[key]);
            return {
                stop() {
                    if (!subscribers[key]) {
                        // Already stopped.
                        return;
                    }
                    subscribers[key] = subscribers[key].filter(
                        (s) => s !== onChange
                    );
                    if (subscribers[key].length === 0) {
                        delete subscribers[key];
                    }
                },
            };
        },
    };
}
