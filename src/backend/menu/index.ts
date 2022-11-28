import { Menu, MenuItemConstructorOptions } from "electron";
import { isDev } from "../util/dev";

export type MenuManagerOptions = {
    createWindow: () => void;
    closeWindow: () => void;
    openDevTools: () => void;
    reloadWindow: () => void;
};

export type MenuManager = {
    initialize: () => void;
};

export function createMenuManager(options: MenuManagerOptions): MenuManager {
    const { createWindow, closeWindow, openDevTools, reloadWindow } = options;
    const initialize = () => {
        // TODO: multiplatform testing
        const menuTemplate: MenuItemConstructorOptions[] = [
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
                            createWindow();
                        },
                    },
                    {
                        label: "Close Window",
                        accelerator:
                            process.platform === "darwin" ? "Cmd+W" : "Ctrl+W",
                        click: () => {
                            closeWindow();
                        },
                    },
                ],
            },
            {
                label: "Edit",
                role: "editMenu",
            },
        ];
        if (isDev()) {
            menuTemplate.push({
                label: "Developer",
                submenu: [
                    {
                        // TODO: this is bad and should be temporary!
                        label: "Open Development Tools",
                        accelerator: "Option+Cmd+I",
                        click: () => {
                            openDevTools();
                        },
                    },
                    {
                        label: "Reload",
                        accelerator: "Cmd+R",
                        click: () => {
                            reloadWindow();
                        },
                    },
                ],
            });
        }
        menuTemplate.push({
            label: "Window",
            role: "windowMenu",
        });

        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    };

    return {
        initialize,
    };
}
