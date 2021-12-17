import { IpcMain } from "electron";
import { ipcMainAsyncRegister } from "../../common/ipc/async-function";
import { K8sConnector } from "../k8s";

type IpcComponents = {
    k8sConnector: K8sConnector;
};
export async function initIpc(
    ipcMain: IpcMain,
    { k8sConnector }: IpcComponents
): Promise<void> {
    const asyncMainRegister = ipcMainAsyncRegister(ipcMain);

    asyncMainRegister("k8s:availableContexts", () => {
        return k8sConnector.availableContexts();
    });
}
