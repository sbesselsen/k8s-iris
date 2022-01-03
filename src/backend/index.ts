import { app, BrowserWindow } from "electron";
import { createCloudManager } from "./cloud";
import { wireCloudIpc } from "./cloud/ipc";
import { createClientManager } from "./k8s";
import { wireK8sClientIpc } from "./k8s/ipc";
import { createMenuManager } from "./menu";
import { createWindowManager } from "./window";

(async () => {
    await app.whenReady();

    const cloudManager = createCloudManager();
    const k8sClientManager = createClientManager();
    const windowManager = createWindowManager();
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

    // Set default params for new windows.
    windowManager.setDefaultWindowParameters({
        context: k8sClientManager.defaultContext(),
        namespaces: k8sClientManager.defaultNamespaces(),
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
