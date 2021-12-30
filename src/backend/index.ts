import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";

import { k8sConnector } from "./k8s";

// modify your existing createWindow() function
const createWindow = () => {
    return;

    const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: "Charm",
        webPreferences: {
            preload: path.join(__dirname, "..", "preload", "index.js"),
        },
    });

    win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
};

(async () => {
    await app.whenReady();

    // Load our components.
    const k8sConn = await k8sConnector();

    // Open our main window.
    createWindow();

    app.on("activate", () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
})();

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
