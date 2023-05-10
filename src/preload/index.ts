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
const openUrlInBrowser = ipcInvoker("app:openUrlInBrowser");
const augmentK8sContexts = ipcInvoker("cloud:augmentK8sContexts");
const loginForContext = ipcInvoker("cloud:loginForContext");
const listContexts = ipcInvoker("k8s:listContexts");
const read = ipcInvoker("k8s:client:read");
const apply = ipcInvoker("k8s:client:apply");
const patch = ipcInvoker("k8s:client:patch");
const replace = ipcInvoker("k8s:client:replace");
const redeploy = ipcInvoker("k8s:client:redeploy");
const remove = ipcInvoker("k8s:client:remove");
const list = ipcInvoker("k8s:client:list");
const listWatch = ipcSubscriber("k8s:client:listWatch");
const listApiResourceTypes = ipcInvoker("k8s:client:listApiResourceTypes");
const exec = ipcSocketOpener("k8s:client:exec");
const execCommand = ipcInvoker("k8s:client:execCommand");
const log = ipcInvoker("k8s:client:log");
const logWatch = ipcSubscriber("k8s:client:logWatch");
const listPortForwards = ipcInvoker("k8s:client:listPortForwards");
const watchPortForwards = ipcSubscriber("k8s:client:watchPortForwards");
const portForward = ipcInvoker("k8s:client:portForward");
const stopPortForward = ipcInvoker("k8s:client:stopPortForward");
const getVersion = ipcInvoker("k8s:client:getVersion");
const onWindowFocusChange = ipcEventSubscriber<boolean>(
    "app:window:focus-change"
);
const setContextLock = ipcInvoker("contextLock:set");
const watchContextLock = ipcSubscriber("contextLock:watch");
const openForContext = ipcSocketOpener("shell:openForContext");
const getAccentColor = ipcInvoker("appAppearance:getAccentColor");
const watchAccentColor = ipcSubscriber("appAppearance:watchAccentColor");
const contextMenuPopup = ipcInvoker("contextMenu:popup");

const prefsRead = ipcInvoker("prefs:read");
const prefsWrite = ipcInvoker("prefs:write");
const prefsDelete = ipcInvoker("prefs:delete");
const prefsSubscribe = ipcSubscriber("prefs:subscribe");

contextBridge.exposeInMainWorld("charm", {
    app: {
        createWindow,
        onWindowFocusChange,
        showDialog,
        openUrlInBrowser,
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
        redeploy,
        remove,
        exec,
        execCommand,
        list,
        listWatch,
        log,
        logWatch,
        listApiResourceTypes,
        listPortForwards,
        watchPortForwards,
        portForward,
        stopPortForward,
        getVersion,
    },
    contextLock: {
        set: setContextLock,
        watch: watchContextLock,
    },
    shell: {
        openForContext,
    },
    appearance: {
        getAccentColor,
        watchAccentColor,
    },
    contextMenu: {
        popup: contextMenuPopup,
    },
    prefs: {
        read: prefsRead,
        write: prefsWrite,
        delete: prefsDelete,
        subscribe: prefsSubscribe,
    },
} as IpcCalls);
