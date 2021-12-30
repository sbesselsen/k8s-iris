import { ipcRenderer } from "electron";
import { prefixEventChannel, prefixHandlerChannel } from "./shared";

function ipcInvoke<T, U>(name: string, data: T): Promise<U> {
    return ipcRenderer.invoke(prefixHandlerChannel(name), data);
}

export function ipcInvoker<T, U>(name: string): (data: T) => Promise<U> {
    return (data) => ipcInvoke(name, data);
}

export function ipcListen<T>(name: string, listener: (data: T) => void): void {
    ipcRenderer.on(prefixEventChannel(name), (e, data) => {
        listener(data);
    });
}
