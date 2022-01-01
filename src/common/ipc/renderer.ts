import { ipcRenderer } from "electron";
import { prefixHandlerChannel, prefixSubscriptionChannel } from "./shared";

function ipcInvoke<T, U>(name: string, data: T): Promise<U> {
    return ipcRenderer.invoke(prefixHandlerChannel(name), data);
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
    handler: (message: U) => void
): IpcSubscription {
    let stopped = false;
    let stopSubscription: () => void | undefined;

    (async () => {
        const subscriptionChannel = await ipcRenderer.invoke(
            prefixSubscriptionChannel(name),
            data
        );
        const listener = (e, data) => {
            if (!data) {
                stopSubscription();
                return;
            }
            handler(data.message);
        };
        ipcRenderer.on(subscriptionChannel, listener);
        stopSubscription = () => {
            ipcRenderer.send(`${subscriptionChannel}:stop`);
            ipcRenderer.off(subscriptionChannel, listener);
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
): (data: T, handler: (message: U) => void) => IpcSubscription {
    return (data, handler) => ipcSubscribe(name, data, handler);
}
