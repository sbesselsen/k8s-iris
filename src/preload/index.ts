import { contextBridge, ipcRenderer } from "electron";
import { ipcInvoker } from "../common/ipc/renderer";
import { IpcCalls } from "../types/ipc";

const listContexts = ipcInvoker("k8s:listContexts");

contextBridge.exposeInMainWorld("charm", {
    k8s: {
        listContexts,
    },
} as IpcCalls);
