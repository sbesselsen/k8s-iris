import { Menu } from "electron";
import { WindowManager } from "../window";

export type MenuManagerOptions = {
    windowManager: WindowManager;
};

export type MenuManager = {
    initialize: () => void;
};

export function createMenuManager(options: MenuManagerOptions): MenuManager {
    const { windowManager } = options;
    const initialize = () => {
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
                                process.platform === "darwin"
                                    ? "Cmd+W"
                                    : "Ctrl+W",
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
    };

    return {
        initialize,
    };
}
