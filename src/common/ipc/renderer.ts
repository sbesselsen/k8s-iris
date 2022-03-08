import { ipcRenderer } from "electron";
import {
    prefixEventChannel,
    prefixHandlerChannel,
    prefixSubscriptionChannel,
} from "./shared";

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
        const listener = (e, data) => {
            if (!data) {
                stopSubscription();
                return;
            }
            handler(data.error, data.message);
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

    ipcRenderer.on(prefixEventChannel(name), (_e, data) => {
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
