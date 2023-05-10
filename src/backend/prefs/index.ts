import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

export type PrefsManagerOptions = {
    storageDirectory?: string;
};

export type PrefsManager = {
    read(key: string): Promise<undefined | unknown>;
    write(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    subscribe(
        key: string,
        onChange: (newValue: undefined | unknown) => void
    ): { stop(): void };
};

export function createPrefsManager(
    opts: PrefsManagerOptions = {}
): PrefsManager {
    const storageDirectory = opts.storageDirectory ?? app.getPath("userData");
    if (!fs.existsSync(storageDirectory)) {
        console.log("Creating storage dir", storageDirectory);
        fs.mkdirSync(storageDirectory, {
            recursive: true,
        });
    }

    const storageFilePath = path.join(storageDirectory, "preferences.json");

    let prefs: Record<string, unknown> = {};
    const subscribers: Record<string, Array<(newValue: unknown) => void>> = {};

    // Load preferences.
    if (fs.existsSync(storageFilePath)) {
        // Create an empty preferences file.
        let data = "{}";
        try {
            data = fs.readFileSync(storageFilePath, "utf8");
        } catch (e) {
            console.error(
                `Error reading preferences file at ${storageFilePath}: ${e}`
            );
        }
        try {
            prefs = JSON.parse(data);
        } catch (e) {
            console.error(
                `Error parsing preferences file at ${storageFilePath}: ${e}`
            );
        }
    }

    function commit() {
        // Commit prefs synchronously to prevent race conditions.
        fs.writeFileSync(storageFilePath, JSON.stringify(prefs));
    }

    return {
        async read(key) {
            return prefs[key];
        },
        async write(key, value) {
            prefs[key] = value;
            subscribers[key]?.forEach((s) => s(value));
            setTimeout(commit, 0);
        },
        async delete(key) {
            delete prefs[key];
            subscribers[key]?.forEach((s) => s(undefined));
            setTimeout(commit, 0);
        },
        subscribe(key, onChange) {
            if (!subscribers[key]) {
                subscribers[key] = [];
            }
            subscribers[key].push(onChange);
            onChange(prefs[key]);
            return {
                stop() {
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
