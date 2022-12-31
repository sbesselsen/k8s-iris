import { ipcRenderer, IpcRendererEvent } from "electron";
import {
    prefixEventChannel,
    prefixHandlerChannel,
    prefixSocketChannel,
    prefixSubscriptionChannel,
    unwrapError,
} from "./shared";

let ipcRendererSubscriberTotal = 0;
let ipcRendererMaxListeners = ipcRenderer.getMaxListeners();

function ipcRendererOn(
    channel: string,
    listener: (e: IpcRendererEvent, ...args: any[]) => void
): void {
    ipcRendererSubscriberTotal++;
    if (ipcRendererSubscriberTotal * 2 > ipcRendererMaxListeners) {
        console.log(
            "Increasing ipc renderer max listeners to:",
            ipcRendererMaxListeners * 2
        );
        ipcRendererMaxListeners *= 2;
        ipcRenderer.setMaxListeners(ipcRendererMaxListeners);
    }
    ipcRenderer.on(channel, listener);
}

function ipcRendererOff(
    channel: string,
    listener: (...args: any[]) => void
): void {
    ipcRendererSubscriberTotal--;
    ipcRenderer.off(channel, listener);
}

function ipcInvoke<T, U>(name: string, data: T): Promise<U> {
    return ipcRenderer
        .invoke(prefixHandlerChannel(name), data)
        .then((result) => {
            if (result.error) {
                // Pass errors down by ourselves because .invoke() will include too much info in its error messages.
                console.error(`Error invoking ${name}:`, result.error);
                throw result.error;
            }
            return result.value;
        });
}

export function ipcInvoker<T, U>(name: string): (data: T) => Promise<U> {
    return (data) => ipcInvoke(name, data);
}

export type IpcSubscription = {
    stop(): void;
};

function ipcSubscribe<T, U>(
    name: string,
    data: T,
    handler: (error: any | undefined, message?: U | undefined) => void
): IpcSubscription {
    let stopped = false;
    let stopSubscription: () => void | undefined;

    (async () => {
        const subscriptionChannel = await ipcRenderer.invoke(
            prefixSubscriptionChannel(name),
            data
        );
        const listener = (e: any, data: any) => {
            if (!data) {
                stopSubscription();
                return;
            }
            handler(data.error, data.message);
        };
        ipcRendererOn(subscriptionChannel, listener);
        stopSubscription = () => {
            ipcRenderer.send(`${subscriptionChannel}:stop`);
            ipcRendererOff(subscriptionChannel, listener);
        };
        if (stopped) {
            stopSubscription();
        }
        ipcRenderer.send(`${subscriptionChannel}:start`);
    })();
    return {
        stop() {
            stopped = true;
            if (stopSubscription) {
                stopSubscription();
            }
        },
    };
}

export function ipcSubscriber<T, U>(
    name: string
): (
    data: T,
    handler: (error: any | undefined, message?: U | undefined) => void
) => IpcSubscription {
    return (data, handler) => ipcSubscribe(name, data, handler);
}

export type IpcEventSubscription = {
    stop(): void;
};

export function ipcEventSubscriber<T>(
    name: string
): (handler: (event: T) => void) => IpcEventSubscription {
    let handlers: Array<(event: T) => void> = [];

    ipcRendererOn(prefixEventChannel(name), (_e, data) => {
        handlers.forEach((h) => h(data));
    });

    return (handler) => {
        handlers.push(handler);
        return {
            stop() {
                handlers = handlers.filter((h) => h !== handler);
            },
        };
    };
}

export type IpcRendererSocketHooks = {
    onMessage: (listener: (message: string | ArrayBuffer) => void) => void;
    onClose: (listener: () => void) => void;
    close: () => void;
    send: (message: string | ArrayBuffer) => void;
};

export function ipcSocketOpener<T>(
    name: string
): (data: T) => Promise<IpcRendererSocketHooks> {
    return async (data: T) => {
        const channel = new MessageChannel();
        const port = channel.port2;

        const startMessagePromise = new Promise<void>((resolve, reject) => {
            port.onmessage = (e) => {
                const [type, error] = e.data;
                if (type === -2) {
                    // This is the start message.
                    if (error) {
                        reject(unwrapError(error));
                        return;
                    }
                    resolve();
                } else {
                    reject(new Error("Invalid start message received"));
                }
            };
        });
        console.log("Opening socket", prefixSocketChannel(name));

        ipcRenderer.postMessage(prefixSocketChannel(name), data, [
            channel.port1,
        ]);

        console.log("Waiting for start message");

        let closeListener: () => void | undefined;

        // Wait until the other end is ready.
        await startMessagePromise;

        console.log("Start message received");

        return {
            onMessage: (listener: (message: string | ArrayBuffer) => void) => {
                port.onmessage = (e) => {
                    const [type, data] = e.data;
                    if (type === 0) {
                        listener(data);
                    } else if (type === -1) {
                        closeListener?.();
                    }
                };
                port.start();
            },
            onClose: (listener: () => void) => {
                closeListener = listener;
            },
            close: () => {
                port.close();
            },
            send: (message: string | ArrayBuffer) => {
                port.postMessage(message);
            },
        };
    };
}
