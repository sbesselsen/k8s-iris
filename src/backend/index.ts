import { app, BrowserWindow } from "electron";
import { ipcHandle } from "../common/ipc/main";
import { emptyAppRoute } from "../common/route/app-route";
import { DialogOptions, DialogResult } from "../common/ui/dialog";
import { createCloudManager } from "./cloud";
import { wireCloudIpc } from "./cloud/ipc";
import { createClientManager } from "./k8s";
import { wireK8sClientIpc } from "./k8s/ipc";
import { createMenuManager } from "./menu";
import { createPrefsManager } from "./prefs";
import { createShellManager } from "./shell";
import { wireShellIpc } from "./shell/ipc";
import { createWindowManager, WindowParameters } from "./window";

(async () => {
    await app.whenReady();

    const prefsManager = createPrefsManager();
    const k8sClientManager = createClientManager({
        ...(process.env.WRITABLE_CONTEXTS
            ? { writableContexts: process.env.WRITABLE_CONTEXTS.split(/,/) }
            : {}),
    });
    const cloudManager = createCloudManager({
        didLogin: () => {
            // Retry outstanding connections (like for listWatches) when logging in with a cloud provider.
            k8sClientManager.retryConnections();
        },
    });
    const windowManager = createWindowManager();
    const shellManager = createShellManager({
        shellWrappers: [],
    });
    const menuManager = createMenuManager({
        createWindow: () => {
            windowManager.createWindow();
        },
        closeWindow: () => {
            windowManager.closeWindow();
        },
        openDevTools: () => {
            windowManager.openDevTools();
        },
    });

    // Initialize the main menu.
    menuManager.initialize();

    // Hook up IPC calls.
    wireCloudIpc(cloudManager);
    wireK8sClientIpc(k8sClientManager);
    wireShellIpc(shellManager);

    ipcHandle("app:createWindow", (params?: WindowParameters) => {
        windowManager.createWindow(params);
    });

    ipcHandle(
        "app:showDialog",
        async (options: DialogOptions): Promise<DialogResult> => {
            return windowManager.showDialog(options);
        }
    );

    // Set default params for new windows.
    windowManager.setDefaultWindowParameters({
        route: {
            ...emptyAppRoute,
            context: k8sClientManager.defaultContext() ?? null,
            namespaces: {
                mode: "all",
                selected: k8sClientManager.defaultNamespaces() ?? [],
            },
        },
    });

    // Open our main window.
    windowManager.createWindow();

    app.on("activate", () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            windowManager.createWindow();
        }
    });
})();

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
