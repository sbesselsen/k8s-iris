import { ipcMain } from "electron";
import { prefixHandlerChannel, prefixSubscriptionChannel } from "./shared";

export function ipcHandle<T, U>(
    name: string,
    handler: (data: T) => Promise<U> | U
): void {
    ipcMain.handle(prefixHandlerChannel(name), async (_, data) => {
        return await handler(data);
    });
}

let subscriptionChannelId = 0;

export function ipcProvideSubscription<T, U>(
    name: string,
    handler: (
        data: T,
        send: (data: U | undefined) => void
    ) => { stop: () => void }
): void {
    ipcMain.handle(prefixSubscriptionChannel(name), async (_, data) => {
        // New incoming subscription. Create a channel.
        const subscriptionChannel = prefixSubscriptionChannel(
            `${name}:${subscriptionChannelId++}`
        );

        ipcMain.once(`${subscriptionChannel}:start`, (e) => {
            // The subscriber says they are ready.
            const webContents = e.sender;

            const { stop } = handler(data, (message) => {
                // We have received a message from the handler.
                if (message === undefined) {
                    // This is the last message. Send a termination message down the chute.
                    webContents.send(subscriptionChannel, null);
                    return;
                }
                webContents.send(subscriptionChannel, { message });
            });

            const webContentsDestroyListener = () => {
                stop();
            };

            const webContentsDidNavigateListener = () => {
                stop();
            };

            webContents.on("destroyed", webContentsDestroyListener);
            webContents.on("did-navigate", webContentsDidNavigateListener);
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
