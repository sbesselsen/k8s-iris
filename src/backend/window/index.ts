import {
    BrowserWindow,
    BrowserWindowConstructorOptions,
    Menu,
    MenuItem,
    nativeTheme,
    dialog,
} from "electron";
import * as path from "path";
import { prefixEventChannel } from "../../common/ipc/shared";
import { AppRoute, emptyAppRoute } from "../../common/route/app-route";
import { DialogOptions, DialogResult } from "../../common/ui/dialog";
import { isDev } from "../util/dev";

export type WindowManager = {
    closeWindow(windowId?: string): void;
    createWindow(params?: WindowParameters): Promise<string>;
    openDevTools(): void;
    setDefaultWindowParameters(params: WindowParameters): void;
    showDialog(options: DialogOptions): Promise<DialogResult>;
};

export type WindowParameters = {
    route: AppRoute;
};

type WindowHandle = {
    window: BrowserWindow;
};

export function createWindowManager(): WindowManager {
    const windowHandles: Record<string, WindowHandle> = {};
    let defaultWindowParameters: WindowParameters = {
        route: emptyAppRoute,
    };

    const generateWindowId = (() => {
        let counter = 0;
        return () => `win-${counter++}`;
    })();

    const distDir = path.join(__dirname, "..", "..", "..", "dist");

    const createWindow = async (
        params: Partial<WindowParameters> = {}
    ): Promise<string> => {
        const options: BrowserWindowConstructorOptions = {
            width: 850,
            height: 600,
            minWidth: 380,
            titleBarStyle: "hiddenInset",
            title: "Charm",
            trafficLightPosition: {
                x: 14,
                y: 16,
            },
            backgroundColor: nativeTheme.shouldUseDarkColors ? "#000" : "#fff",
            show: false,
            webPreferences: {
                backgroundThrottling: false,
                preload: path.join(distDir, "preload", "index.js"),
            },
        };

        // Take some options from current window.
        let currentWindow = BrowserWindow.getFocusedWindow();
        if (!currentWindow) {
            currentWindow = BrowserWindow.getAllWindows()[0];
        }

        const inheritedParams: Partial<WindowParameters> = {};

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
                    if (currentWindowParams?.route) {
                        inheritedParams.route = currentWindowParams.route;
                    }
                } catch (e) {
                    // Guess these are not window params then.
                }
            }
        }
        const windowId = generateWindowId();

        const win = new BrowserWindow(options);
        const windowHash = Buffer.from(
            JSON.stringify({
                ...defaultWindowParameters,
                ...inheritedParams,
                ...params,
                windowId,
            }),
            "utf-8"
        ).toString("base64");

        if (isDev()) {
            win.loadURL("http://localhost:1234/#" + windowHash);
        } else {
            win.loadFile(path.join(distDir, "renderer", "index.html"), {
                hash: windowHash,
            });
        }
        win.webContents.on("did-finish-load", () => {
            win.webContents.send(
                prefixEventChannel("app:window:focus-change"),
                win.isFocused()
            );
        });
        win.webContents.on("context-menu", (_, props) => {
            const menu = new Menu();
            if (props.editFlags.canCut) {
                menu.append(
                    new MenuItem({
                        label: "Cut",
                        role: "cut",
                        accelerator: "CommandOrControl+X",
                    })
                );
            }
            if (props.editFlags.canCopy) {
                menu.append(
                    new MenuItem({
                        label: "Copy",
                        role: "copy",
                        accelerator: "CommandOrControl+C",
                    })
                );
            }
            if (props.editFlags.canPaste) {
                menu.append(
                    new MenuItem({
                        label: "Paste",
                        role: "paste",
                        accelerator: "CommandOrControl+V",
                    })
                );
            }
            menu.popup();
        });
        win.on("focus", () => {
            win.webContents.send(
                prefixEventChannel("app:window:focus-change"),
                true
            );
        });
        win.on("blur", () => {
            win.webContents.send(
                prefixEventChannel("app:window:focus-change"),
                false
            );
        });
        win.on("ready-to-show", () => {
            win.webContents.send(
                prefixEventChannel("app:window:focus-change"),
                win.isFocused()
            );
            win.show();
        });

        windowHandles[windowId] = {
            window: win,
        };
        return windowId;
    };

    const closeWindow = (windowId?: string) => {
        const window = windowId
            ? windowHandles[windowId].window
            : BrowserWindow.getFocusedWindow();
        window?.close();
    };

    const openDevTools = () => {
        BrowserWindow.getFocusedWindow()?.webContents.openDevTools();
    };

    const setDefaultWindowParameters = (params: WindowParameters): void => {
        defaultWindowParameters = params;
    };

    const showDialog = async (
        options: DialogOptions
    ): Promise<DialogResult> => {
        const { attachToWindow = true, ...dialogOptions } = options;
        let browserWindow: BrowserWindow;
        if (attachToWindow) {
            const windowId = (options as any).windowId;
            browserWindow = windowId
                ? windowHandles[windowId].window
                : undefined;
        }
        const result = await dialog.showMessageBox(
            browserWindow,
            dialogOptions
        );
        return { response: result.response };
    };

    return {
        closeWindow,
        createWindow,
        openDevTools,
        setDefaultWindowParameters,
        showDialog,
    };
}
