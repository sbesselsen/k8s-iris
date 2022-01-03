import { app, BrowserWindow, Menu } from "electron";
import { createClientManager } from "./k8s";
import { wireK8sClientIpc } from "./k8s/ipc";
import { createWindowManager } from "./window";

(async () => {
    await app.whenReady();

    // TODO: multiplatform shit
    Menu.setApplicationMenu(
        Menu.buildFromTemplate([
            {
                label: "Charm",
                role: "appMenu",
            },
            {
                label: "File",
                role: "fileMenu",
                submenu: [
                    {
                        label: "New Window",
                        accelerator:
                            process.platform === "darwin"
                                ? "Shift+Cmd+N"
                                : "Shift+Ctrl+N",
                        click: () => {
                            windowManager.createWindow();
                        },
                    },
                    {
                        label: "Close Window",
                        accelerator:
                            process.platform === "darwin" ? "Cmd+W" : "Ctrl+W",
                        click: () => {
                            windowManager.closeWindow();
                        },
                    },
                ],
            },
            {
                label: "Edit",
                role: "editMenu",
            },
            {
                label: "Window",
                role: "windowMenu",
            },
        ])
    );

    const k8sClientManager = createClientManager();
    const windowManager = createWindowManager();

    // Hook up IPC calls.
    wireK8sClientIpc(k8sClientManager);

    // Set default params for new windows.
    windowManager.setDefaultWindowParameters({
        context: k8sClientManager.defaultContext(),
        namespaces: k8sClientManager.defaultNamespaces(),
    });

    // Open our main window.
    windowManager.createWindow();

    // Menu.setApplicationMenu(appMenu);

    // console.log(Menu.getApplicationMenu().items);
    // menu.append(
    //     new MenuItem({
    //         label: "Electron",
    //         submenu: [
    //             {
    //                 role: "help",
    //                 accelerator:
    //                     process.platform === "darwin"
    //                         ? "Alt+Cmd+I"
    //                         : "Alt+Shift+I",
    //                 click: () => {
    //                     console.log("Electron rocks!");
    //                 },
    //             },
    //         ],
    //     })
    // );

    // Menu.setApplicationMenu(menu);

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
