import { app } from "electron";
import * as fs from "fs";

export type PrefsManagerOptions = {
    storageDirectory?: string;
};

export type PrefsManager = {};

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
    return {};
}
