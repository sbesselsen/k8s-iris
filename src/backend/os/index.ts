import { shell } from "electron";

export type OsManager = {
    openUrlInBrowser: (url: string) => Promise<void>;
};

export function createOsManager(): OsManager {
    const openUrlInBrowser = async (url: string): Promise<void> => {
        await shell.openExternal(url);
    };

    return { openUrlInBrowser };
}
