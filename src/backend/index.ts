import { app, BrowserWindow } from "electron";
import { ipcHandle } from "../common/ipc/main";
import { getDefaultContext, getDefaultNamespaces, listContexts } from "./k8s";
import { createWindowManager } from "./window";

(async () => {
    await app.whenReady();

    // Hook up IPC calls.
    ipcHandle("k8s:listContexts", listContexts);

    const windowManager = createWindowManager();

    // Set default params for new windows.
    windowManager.setDefaultWindowParameters({
        context: getDefaultContext(),
        namespaces: getDefaultNamespaces(),
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
