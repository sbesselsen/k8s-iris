import { contextBridge } from "electron";
import {
    ipcInvoker,
    ipcEventSubscriber,
    ipcSubscriber,
    ipcSocketOpener,
} from "../common/ipc/renderer";
import { IpcCalls } from "../common/ipc-types";

const createWindow = ipcInvoker("app:createWindow");
const showDialog = ipcInvoker("app:showDialog");
const augmentK8sContexts = ipcInvoker("cloud:augmentK8sContexts");
const loginForContext = ipcInvoker("cloud:loginForContext");
const listContexts = ipcInvoker("k8s:listContexts");
const read = ipcInvoker("k8s:client:read");
const apply = ipcInvoker("k8s:client:apply");
const patch = ipcInvoker("k8s:client:patch");
const replace = ipcInvoker("k8s:client:replace");
const remove = ipcInvoker("k8s:client:remove");
const list = ipcInvoker("k8s:client:list");
const listWatch = ipcSubscriber("k8s:client:listWatch");
const listApiResourceTypes = ipcInvoker("k8s:client:listApiResourceTypes");
const exec = ipcSocketOpener("k8s:client:exec");
const execCommand = ipcInvoker("k8s:client:execCommand");
const log = ipcInvoker("k8s:client:log");
const logWatch = ipcSubscriber("k8s:client:logWatch");
const onWindowFocusChange = ipcEventSubscriber<boolean>(
    "app:window:focus-change"
);

contextBridge.exposeInMainWorld("charm", {
    app: {
        createWindow,
        onWindowFocusChange,
        showDialog,
    },
    cloud: {
        augmentK8sContexts,
        loginForContext,
    },
    k8s: {
        listContexts,
        read,
        apply,
        patch,
        replace,
        remove,
        exec,
        execCommand,
        list,
        listWatch,
        log,
        logWatch,
        listApiResourceTypes,
    },
} as IpcCalls);
