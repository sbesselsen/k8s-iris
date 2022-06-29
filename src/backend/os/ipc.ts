import { OsManager } from "./index";
import { ipcHandle } from "../../common/ipc/main";

export const wireOsIpc = (osManager: OsManager): void => {
    ipcHandle("app:openUrlInBrowser", ({ url }: { url: string }) =>
        osManager.openUrlInBrowser(url)
    );
};
