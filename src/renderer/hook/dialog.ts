import { DialogOptions, DialogResult } from "../../common/ui/dialog";
import { getHashParams } from "../util/location";
import { useIpcCall } from "./ipc";

export const useDialog = (): ((
    options: DialogOptions
) => Promise<DialogResult>) => {
    const call = useIpcCall((ipc) => ipc.app.showDialog);
    return (options: DialogOptions) => {
        const { windowId = undefined } = getHashParams() ?? {};
        return call({ ...options, windowId } as DialogOptions);
    };
};
