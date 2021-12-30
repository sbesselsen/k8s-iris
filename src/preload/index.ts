import { contextBridge, ipcRenderer } from "electron";
import { Context } from "../types/k8s";
import { IpcCalls } from "../types/ipc";

// const asyncInvoker = ipcRendererAsyncInvoker(ipcRenderer);

// contextBridge.exposeInMainWorld("charm", {
//     k8s: {
//         availableContexts: asyncInvoker<void, Context[]>(
//             "k8s:availableContexts"
//         ),
//     },
//     app: {
//         openContext: asyncInvoker<string, void>("app:openContext"),
//     },
// } as IpcCalls);
