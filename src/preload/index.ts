import { contextBridge, ipcRenderer } from "electron";
import { Context } from "../types/k8s";
import { IpcCalls } from "../types/ipc";
import { ipcRendererAsyncInvoker } from "../common/ipc/async-function";

const asyncInvoker = ipcRendererAsyncInvoker(ipcRenderer);

contextBridge.exposeInMainWorld("charm", {
    k8s: {
        availableContexts: asyncInvoker<void, Context[]>(
            "k8s:availableContexts"
        ),
    },
} as IpcCalls);
