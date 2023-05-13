import { app, BrowserWindow } from "electron";
import { ipcHandle } from "../common/ipc/main";
import { emptyAppRoute } from "../common/route/app-route";
import { DialogOptions, DialogResult } from "../common/ui/dialog";
import { createAppearanceManager } from "./appearance";
import { wireAppearanceIpc } from "./appearance/ipc";
import { createCloudManager } from "./cloud";
import { wireCloudIpc } from "./cloud/ipc";
import { cloudShellWrapper } from "./cloud/shell";
import { createContextLockManager } from "./context-lock";
import { wireContextLockIpc } from "./context-lock/ipc";
import { createContextMenuManager } from "./contextmenu";
import { wireContextMenuIpc } from "./contextmenu/ipc";
import { createClientManager } from "./k8s";
import { wireK8sClientIpc } from "./k8s/ipc";
import { k8sShellWrapper } from "./k8s/shell";
import { createMenuManager } from "./menu";
import { createOsManager } from "./os";
import { wireOsIpc } from "./os/ipc";
import { createPrefsManager } from "./prefs";
import { wirePrefsManagerIpc } from "./prefs/ipc";
import { createShellManager } from "./shell";
import { wireShellIpc } from "./shell/ipc";
import { createTempDataManager } from "./temp-data";
import { wireTempDataManagerIpc } from "./temp-data/ipc";
import { shellOptions } from "./util/shell";
import { createWindowManager, WindowParameters } from "./window";

(async () => {
    await app.whenReady();

    (async () => {
        // Warm up shell options.
        const opts = await shellOptions();
        console.log("Shell options: ", opts);
    })();

    const prefsManager = createPrefsManager();
    const tempDataManager = createTempDataManager();
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
        shellWrappers: [
            k8sShellWrapper(k8sClientManager),
            cloudShellWrapper(cloudManager, k8sClientManager),
        ],
    });
    const osManager = createOsManager();
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
        reloadWindow: () => {
            windowManager.reloadWindow();
        },
    });
    const contextLockManager = createContextLockManager();
    const appearanceManager = createAppearanceManager();
    const contextMenuManager = createContextMenuManager();

    // Initialize the main menu.
    menuManager.initialize();

    // Hook up IPC calls.
    wirePrefsManagerIpc(prefsManager);
    wireTempDataManagerIpc(tempDataManager);
    wireCloudIpc(cloudManager);
    wireK8sClientIpc(k8sClientManager);
    wireShellIpc(shellManager);
    wireOsIpc(osManager);
    wireContextLockIpc(contextLockManager);
    wireAppearanceIpc(appearanceManager);
    wireContextMenuIpc(contextMenuManager);

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
