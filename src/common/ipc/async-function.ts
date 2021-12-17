import { IpcMain, IpcRenderer } from "electron";

export function ipcMainAsyncRegister(
    ipcMain: IpcMain
): <T, U>(name: string, f: (args: T) => Promise<U>) => void {
    return function asyncRegister<T, U>(
        name: string,
        f: (args: T) => Promise<U>
    ) {
        ipcMain.on(`asyncInvoker:${name}`, async (e, listenerKey, args) => {
            let result;
            let err = null;
            try {
                result = await f(args);
            } catch (e) {
                err = e;
            }
            e.reply("asyncInvoker:response", listenerKey, err, result);
        });
    };
}

export function ipcRendererAsyncInvoker(
    ipcRenderer: IpcRenderer
): <T, U>(name: string) => (args: T) => Promise<U> {
    let listenerId = 1;
    let listeners: Record<string, (error: null | Error, result: any) => void> =
        {};

    ipcRenderer.on(
        "asyncInvoker:response",
        (event, listenerKey, error, result) => {
            listeners[listenerKey](error, result);
            delete listeners[listenerKey];
        }
    );

    return function asyncInvoker<T, U>(name: string): (args: T) => Promise<U> {
        return (args) => {
            return new Promise((resolve, reject) => {
                const listenerKey = `l-${listenerId++}`;
                listeners[listenerKey] = (err, result) => {
                    if (err !== null) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                };
                ipcRenderer.send(`asyncInvoker:${name}`, listenerKey, args);
            });
        };
    };
}
