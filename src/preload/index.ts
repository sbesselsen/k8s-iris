import { contextBridge } from "electron";
import { ipcInvoker, ipcSubscriber } from "../common/ipc/renderer";
import { IpcCalls } from "../common/ipc-types";

const listContexts = ipcInvoker("k8s:listContexts");
const read = ipcInvoker("k8s:client:read");
const apply = ipcInvoker("k8s:client:apply");
const patch = ipcInvoker("k8s:client:patch");
const replace = ipcInvoker("k8s:client:replace");
const remove = ipcInvoker("k8s:client:remove");
const list = ipcInvoker("k8s:client:list");
const listWatch = ipcSubscriber("k8s:client:listWatch");

contextBridge.exposeInMainWorld("charm", {
    k8s: {
        listContexts,
        read,
        apply,
        patch,
        replace,
        remove,
        list,
        listWatch,
    },
} as IpcCalls);
