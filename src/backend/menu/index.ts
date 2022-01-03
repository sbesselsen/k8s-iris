import { Menu } from "electron";

export type MenuManagerOptions = {
    createWindow: () => void;
    closeWindow: () => void;
    openDevTools: () => void;
};

export type MenuManager = {
    initialize: () => void;
};

export function createMenuManager(options: MenuManagerOptions): MenuManager {
    const { createWindow, closeWindow, openDevTools } = options;
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
                                createWindow();
                            },
                        },
                        {
                            label: "Close Window",
                            accelerator:
                                process.platform === "darwin"
                                    ? "Cmd+W"
                                    : "Ctrl+W",
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
                {
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
                    ],
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
