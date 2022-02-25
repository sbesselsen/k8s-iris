import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import * as path from "path";

export type WindowManager = {
    closeWindow(windowId?: string): void;
    createWindow(params?: WindowParameters): Promise<string>;
    openDevTools(): void;
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
        const options: BrowserWindowConstructorOptions = {
            width: 800,
            height: 600,
            title: "Charm",
            webPreferences: {
                preload: path.join(__dirname, "..", "preload", "index.js"),
            },
        };

        // Take some options from current window.
        let currentWindow = BrowserWindow.getFocusedWindow();
        if (!currentWindow) {
            currentWindow = BrowserWindow.getAllWindows()[0];
        }

        const inheritedParams: WindowParameters = {};

        if (currentWindow) {
            const bounds = currentWindow.getBounds();
            options.x = bounds.x + 20;
            options.y = bounds.y + 20;
            options.width = bounds.width;
            options.height = bounds.height;

            const url = currentWindow.webContents.getURL();
            const hashMatch = String(url).match(/#(.*)$/);
            if (hashMatch) {
                try {
                    const currentWindowParams = JSON.parse(
                        Buffer.from(hashMatch[1], "base64").toString("utf-8")
                    );
                    if (currentWindowParams?.context) {
                        inheritedParams.context = currentWindowParams.context;
                    }
                    if (currentWindowParams?.namespaces) {
                        inheritedParams.namespaces =
                            currentWindowParams.namespaces;
                    }
                } catch (e) {
                    // Guess these are not window params then.
                }
            }
        }

        const win = new BrowserWindow(options);

        win.loadFile(path.join(__dirname, "..", "renderer", "index.html"), {
            hash: Buffer.from(
                JSON.stringify({
                    ...defaultWindowParameters,
                    ...inheritedParams,
                    ...params,
                }),
                "utf-8"
            ).toString("base64"),
        });

        const windowId = generateWindowId();
        windowHandles[windowId] = {
            window: win,
        };
        return windowId;
    };

    const closeWindow = (windowId?: string) => {
        const window = windowId
            ? windowHandles[windowId].window
            : BrowserWindow.getFocusedWindow();
        window.close();
    };

    const openDevTools = () => {
        BrowserWindow.getFocusedWindow()?.webContents.openDevTools();
    };

    const setDefaultWindowParameters = (params: WindowParameters): void => {
        defaultWindowParameters = params;
    };

    return {
        closeWindow,
        createWindow,
        openDevTools,
        setDefaultWindowParameters,
    };
}
