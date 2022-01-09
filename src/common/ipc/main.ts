import { ipcMain } from "electron";
import { prefixHandlerChannel, prefixSubscriptionChannel } from "./shared";

export function ipcHandle<T, U>(
    name: string,
    handler: (data: T) => Promise<U> | U
): void {
    ipcMain.handle(prefixHandlerChannel(name), async (_, data) => {
        try {
            return { value: await handler(data) };
        } catch (e) {
            return { error: String(e) };
        }
    });
}

let subscriptionChannelId = 0;

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

        let stop = () => {};

        ipcMain.once(`${subscriptionChannel}:start`, (e) => {
            // The subscriber says they are ready.
            const webContents = e.sender;

            try {
                const handlerResult = handler(data, (error, message) => {
                    // We have received a message from the handler.
                    if (message === undefined && error === undefined) {
                        // This is the last message. Send a termination message down the chute.
                        webContents.send(subscriptionChannel, null);
                        return;
                    }
                    webContents.send(subscriptionChannel, { error, message });
                });
                stop = handlerResult.stop;
            } catch (e) {
                webContents.send(subscriptionChannel, { error: e });
            }

            const webContentsDestroyListener = () => {
                stop();
            };

            const webContentsDidNavigateListener = () => {
                stop();
            };

            webContents.once("destroyed", webContentsDestroyListener);
            webContents.once("did-navigate", webContentsDidNavigateListener);
            ipcMain.once(`${subscriptionChannel}:stop`, () => {
                // The subscriber says they want to stop.
                webContents.off("destroyed", webContentsDestroyListener);
                webContents.off("did-navigate", webContentsDidNavigateListener);
                stop();
            });
        });

        // Send the channel to the subscriber.
        return subscriptionChannel;
    });
}
