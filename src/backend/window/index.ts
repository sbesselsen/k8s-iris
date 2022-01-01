import { BrowserWindow } from "electron";
import * as path from "path";

export type WindowManager = {
    createWindow(params?: WindowParameters): Promise<string>;
    setDefaultWindowParameters(params: WindowParameters): void;
};

export type WindowParameters = {
    context?: string;
    namespaces?: string[];
};

type WindowHandle = {
    window: BrowserWindow;
};

export function createWindowManager(): WindowManager {
    const windowHandles: Record<string, WindowHandle> = {};
    let defaultWindowParameters: WindowParameters = {};

    const generateWindowId = (() => {
        let counter = 0;
        return () => `win-${counter++}`;
    })();

    const createWindow = async (
        params: WindowParameters = {}
    ): Promise<string> => {
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            title: "Charm",
            webPreferences: {
                preload: path.join(__dirname, "..", "preload", "index.js"),
            },
        });

        win.loadFile(path.join(__dirname, "..", "renderer", "index.html"), {
            search: Buffer.from(
                JSON.stringify({ ...defaultWindowParameters, ...params }),
                "utf-8"
            ).toString("base64"),
        });

        const windowId = generateWindowId();
        windowHandles[windowId] = {
            window: win,
        };
        return windowId;
    };

    const setDefaultWindowParameters = (params: WindowParameters): void => {
        defaultWindowParameters = params;
    };

    return {
        createWindow,
        setDefaultWindowParameters,
    };
}
