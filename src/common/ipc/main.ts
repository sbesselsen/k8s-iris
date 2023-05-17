import { ipcMain } from "electron";
import { debugCounters } from "../util/debug";
import {
    prefixHandlerChannel,
    prefixSocketChannel,
    prefixSubscriptionChannel,
    wrapError,
} from "./shared";

export function ipcHandle<T, U>(
    name: string,
    handler: (data: T) => Promise<U> | U
): void {
    ipcMain.handle(prefixHandlerChannel(name), async (_, data) => {
        try {
            return { value: await handler(data) };
        } catch (e) {
            return { error: wrapError(e) };
        }
    });
}

let subscriptionChannelId = 0;

const counters = debugCounters("ipcProvideSubscription handlers");

export function ipcProvideSubscription<T, U>(
    name: string,
    handler: (
        data: T,
        send: (error: any | undefined, data: U | undefined) => void
    ) => { stop: () => void }
): void {
    ipcMain.handle(prefixSubscriptionChannel(name), async (_, data) => {
        // New incoming subscription. Create a channel.
        const subscriptionChannel = prefixSubscriptionChannel(
            `${name}:${subscriptionChannelId++}`
        );

        let webContentsDidChange = false;
        let stop = () => {};

        ipcMain.once(`${subscriptionChannel}:start`, (e) => {
            // The subscriber says they are ready.
            const webContents = e.sender;

            try {
                counters.up(name);
                const handlerResult = handler(data, (error, message) => {
                    if (webContentsDidChange) {
                        console.log(
                            "Trying to send message to changed webContents"
                        );
                        return;
                    }

                    // We have received a message from the handler.
                    if (message === undefined && error === undefined) {
                        // This is the last message. Send a termination message down the chute.
                        webContents.send(subscriptionChannel, null);
                        counters.down(name);
                        return;
                    }
                    const err = error ? wrapError(error) : undefined;
                    webContents.send(subscriptionChannel, {
                        error: err,
                        message,
                    });
                });
                stop = handlerResult.stop;
            } catch (e) {
                // First send the error down the chute, then the termination message.
                webContents.send(subscriptionChannel, { error: wrapError(e) });
                webContents.send(subscriptionChannel, null);
            }

            const webContentsDestroyListener = () => {
                webContentsDidChange = true;
                counters.down(name);
                stop();
            };

            const webContentsDidNavigateListener = () => {
                webContentsDidChange = true;
                counters.down(name);
                stop();
            };

            webContents.once("destroyed", webContentsDestroyListener);
            webContents.once("did-navigate", webContentsDidNavigateListener);
            ipcMain.once(`${subscriptionChannel}:stop`, () => {
                // The subscriber says they want to stop.
                webContents.off("destroyed", webContentsDestroyListener);
                webContents.off("did-navigate", webContentsDidNavigateListener);
                counters.down(name);
                stop();
            });
        });

        // Send the channel to the subscriber.
        return subscriptionChannel;
    });
}

export type IpcMainSocketHooks = {
    onMessage: (listener: (message: string | ArrayBuffer) => void) => void;
    onClose: (listener: () => void) => void;
    close: () => void;
    send: (message: string | ArrayBuffer) => void;
};

let portId = 1;

export function ipcProvideSocket<T>(
    name: string,
    handler: (data: T, hooks: IpcMainSocketHooks) => Promise<void>
) {
    ipcMain.on(prefixSocketChannel(name), async (e, data) => {
        const webContents = e.sender;

        const port = e.ports[0];
        const id = portId++;
        console.log("Opening socket port", id);

        let isClosed = false;

        function closePort() {
            if (isClosed) {
                return;
            }
            console.log("Closing socket port", id);
            port.close();
            isClosed = true;
        }

        function webContentsDestroyListener() {
            closePort();
        }

        webContents.once("destroyed", webContentsDestroyListener);
        webContents.once("did-navigate", webContentsDestroyListener);

        try {
            await handler(data, {
                onMessage: (
                    listener: (message: string | ArrayBuffer) => void
                ) => {
                    port.on("message", (e) => {
                        listener(e.data);
                    });
                    port.start();
                },
                onClose: (listener: () => void) => {
                    port.on("close", () => {
                        listener();
                    });
                },
                close: () => {
                    port.postMessage([-1, null]);
                    closePort();
                },
                send: (message: string | ArrayBuffer) => {
                    port.postMessage([0, message]);
                },
            });
            // We are ready. Send start message.
            console.log("Opened socket handler", id);
            port.postMessage([-2, null]);
        } catch (e) {
            console.error("Error opening socket handler", id, e);
            port.postMessage([-2, wrapError(e)]);
            closePort();
        }
    });
}
