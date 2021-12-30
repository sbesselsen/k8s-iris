import { BrowserWindow, ipcMain } from "electron";
import { prefixEventChannel, prefixHandlerChannel } from "./shared";

export function ipcHandle<T, U>(
    name: string,
    handler: (data: T) => Promise<U> | U
): void {
    ipcMain.handle(prefixHandlerChannel(name), async (e, data) => {
        return await handler(data);
    });
}

let windows: BrowserWindow[] = [];

export function ipcAddWindow(window: BrowserWindow) {
    windows.push(window);
}

export function ipcRemoveWindow(window: BrowserWindow) {
    windows = windows.filter((win) => win !== window);
}

function ipcBroadcast(name: string, data: any): void {
    const channel = prefixEventChannel(name);
    windows.forEach((win) => win.webContents.send(channel, data));
}

export function ipcBroadcaster<T>(name: string): (data: T) => void {
    return (data) => ipcBroadcast(name, data);
}
