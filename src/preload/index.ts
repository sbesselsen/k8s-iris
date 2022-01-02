import { contextBridge, ipcRenderer } from "electron";
import { ipcInvoker } from "../common/ipc/renderer";
import { IpcCalls } from "../types/ipc";

const listContexts = ipcInvoker("k8s:listContexts");
const read = ipcInvoker("k8s:client:read");
const apply = ipcInvoker("k8s:client:apply");
const patch = ipcInvoker("k8s:client:patch");
const replace = ipcInvoker("k8s:client:replace");
const remove = ipcInvoker("k8s:client:remove");
const list = ipcInvoker("k8s:client:list");

contextBridge.exposeInMainWorld("charm", {
    k8s: {
        listContexts,
        read,
        apply,
        patch,
        replace,
        remove,
        list,
    },
} as IpcCalls);
