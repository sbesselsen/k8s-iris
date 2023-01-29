import { DialogOptions, DialogResult } from "../../common/ui/dialog";
import { truncate } from "../../common/util/truncate";
import { getHashParams } from "../util/location";
import { useIpcCall } from "./ipc";

export const useDialog = (): ((
    options: DialogOptions
) => Promise<DialogResult>) => {
    const call = useIpcCall((ipc) => ipc.app.showDialog);
    return (options: DialogOptions) => {
        const { windowId = undefined } = getHashParams() ?? {};

        if (options.detail) {
            options.detail = truncate(options.detail, 1000);
        }
        if (options.message) {
            options.message = truncate(options.message, 400);
        }

        return call({ ...options, windowId } as DialogOptions);
    };
};
