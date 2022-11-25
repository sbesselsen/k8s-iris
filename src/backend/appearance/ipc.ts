import { AppearanceManager } from ".";
import { ipcHandle, ipcProvideSubscription } from "../../common/ipc/main";

export function wireAppearanceIpc(appearanceManager: AppearanceManager): void {
    ipcHandle("appAppearance:getAccentColor", () =>
        appearanceManager.getAccentColor()
    );

    ipcProvideSubscription<void, string>(
        "appAppearance:watchAccentColor",
        (_data, send) =>
            appearanceManager.watchAccentColor((color) => {
                send(undefined, color);
            })
    );
}
