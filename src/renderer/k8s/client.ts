import { useMemo, useRef } from "react";
import {
    addListObject,
    deleteListObject,
    updateListObject,
} from "../../common/k8s/util";
import {
    K8sApplyOptions,
    K8sClient,
    K8sExecCommandOptions,
    K8sExecCommandSpec,
    K8sExecHandler,
    K8sExecOptions,
    K8sExecSpec,
    K8sLogOptions,
    K8sLogSpec,
    K8sLogWatch,
    K8sLogWatchOptions,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
    K8sObjectListWatcher,
    K8sPatchOptions,
    K8sPortForwardSpec,
    K8sPortForwardWatcher,
    K8sRemoveOptions,
} from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { useIpcCall } from "../hook/ipc";
import { unwrapError } from "../../common/ipc/shared";
import { K8sPartialObjectListWatcherMessage } from "../../common/ipc-types";
import {
    ContextLockedError,
    useContextLockGetter,
} from "../context/context-lock";

const noop = () => {};

export function useK8sClient(kubeContext?: string): K8sClient {
    const sharedKubeContext = useK8sContext();
    const context = kubeContext ?? sharedKubeContext;

    const ipcRead = useIpcCall((ipc) => ipc.k8s.read);
    const ipcApply = useIpcCall((ipc) => ipc.k8s.apply);
    const ipcPatch = useIpcCall((ipc) => ipc.k8s.patch);
    const ipcReplace = useIpcCall((ipc) => ipc.k8s.replace);
    const ipcRedeploy = useIpcCall((ipc) => ipc.k8s.redeploy);
    const ipcRemove = useIpcCall((ipc) => ipc.k8s.remove);
    const ipcList = useIpcCall((ipc) => ipc.k8s.list);
    const ipcListWatch = useIpcCall((ipc) => ipc.k8s.listWatch);
    const ipcListApiResourceTypes = useIpcCall(
        (ipc) => ipc.k8s.listApiResourceTypes
    );
    const ipcExec = useIpcCall((ipc) => ipc.k8s.exec);
    const ipcExecCommand = useIpcCall((ipc) => ipc.k8s.execCommand);
    const ipcLog = useIpcCall((ipc) => ipc.k8s.log);
    const ipcLogWatch = useIpcCall((ipc) => ipc.k8s.logWatch);
    const ipcListPortForwards = useIpcCall((ipc) => ipc.k8s.listPortForwards);
    const ipcWatchPortForwards = useIpcCall((ipc) => ipc.k8s.watchPortForwards);
    const ipcPortForward = useIpcCall((ipc) => ipc.k8s.portForward);
    const ipcStopPortForward = useIpcCall((ipc) => ipc.k8s.stopPortForward);
    const ipcGetVersion = useIpcCall((ipc) => ipc.k8s.getVersion);
    const listWatchesRef = useRef<K8sObjectListWatch[]>([]);

    const getContextLock = useContextLockGetter();

    const client = useMemo(() => {
        // We are creating a new client. If we still have list watches on the previous client, stop them.
        listWatchesRef.current.forEach((lw) => lw.stop());
        listWatchesRef.current = [];

        const read = (spec: K8sObject) => ipcRead({ context, spec });
        const apply = (spec: K8sObject, options: K8sApplyOptions = {}) => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcApply({ context, spec, options });
        };
        const patch = (spec: K8sObject, options: K8sPatchOptions = {}) => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcPatch({ context, spec, options });
        };
        const replace = (spec: K8sObject) => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcReplace({ context, spec });
        };
        const redeploy = (spec: K8sObject) => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcRedeploy({ context, spec });
        };
        const remove = (spec: K8sObject, options?: K8sRemoveOptions) => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcRemove({ context, spec, options });
        };
        const list = <T extends K8sObject = K8sObject>(
            spec: K8sObjectListQuery
        ) => ipcList<T>({ context, spec });
        const listWatch = <T extends K8sObject = K8sObject>(
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => {
            let objectList: K8sObjectList<T>;

            // Subscribe to list updates.
            const subscription = ipcListWatch(
                { context, spec },
                (error, message) => {
                    if (error) {
                        watcher(unwrapError(error));
                        return;
                    }
                    if (!message) {
                        watcher(
                            new Error(
                                "Unknown subscription error: no message and no error passed"
                            )
                        );
                        return;
                    }
                    if (isListMessage(message)) {
                        objectList = message.list as K8sObjectList<T>;
                        watcher(undefined, { list: objectList });
                        return;
                    }
                    if (message.update !== undefined) {
                        // Process the update.
                        const update = message.update as K8sObjectListUpdate<T>;
                        const { type, object } = update;
                        switch (type) {
                            case "add":
                                objectList = addListObject(objectList, object);
                                watcher(undefined, {
                                    list: objectList,
                                    update,
                                });
                                break;
                            case "remove":
                                objectList = deleteListObject(
                                    objectList,
                                    object
                                );
                                watcher(undefined, {
                                    list: objectList,
                                    update,
                                });
                                break;
                            case "update":
                                objectList = updateListObject(
                                    objectList,
                                    object
                                );
                                watcher(undefined, {
                                    list: objectList,
                                    update,
                                });
                                break;
                        }
                    }
                }
            );

            const result = {
                stop() {
                    listWatchesRef.current = listWatchesRef.current.filter(
                        (lw) => lw !== result
                    );
                    subscription.stop();
                },
            };
            listWatchesRef.current.push(result);
            return result;
        };
        const execCommand = (
            spec: K8sExecCommandSpec,
            options: K8sExecCommandOptions = {}
        ) => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcExecCommand({ context, spec, options });
        };

        const exec = async (
            spec: K8sExecSpec,
            options: K8sExecOptions = {}
        ): Promise<K8sExecHandler> => {
            if (getContextLock()) {
                throw new ContextLockedError("Cluster is locked");
            }
            const hooks = await ipcExec({
                context,
                spec,
                options,
            });
            return {
                onReceive: (listener) => {
                    hooks.onMessage((message) => {
                        if (typeof message === "string") {
                            console.error(
                                "Invalid message in onReceive from exec()"
                            );
                            return;
                        }
                        const view = new Uint8Array(message);
                        if (view[0] === 0) {
                            // stdout
                            listener(message.slice(1), null);
                        } else {
                            // stderr
                            listener(null, message.slice(1));
                        }
                    });
                },
                onEnd: (listener) => {
                    hooks.onClose(listener);
                },
                send: (chunk) => {
                    hooks.send(chunk);
                },
                resizeTerminal: (size) => {
                    const { cols, rows } = size;
                    hooks.send(
                        JSON.stringify({ cmd: "resizeTerminal", cols, rows })
                    );
                },
                close: async () => {
                    // TODO: should we await something here?
                    hooks.close();
                },
            };
        };
        const listApiResourceTypes = () => ipcListApiResourceTypes({ context });

        const log = (spec: K8sLogSpec, options: K8sLogOptions = {}) =>
            ipcLog({ context, spec, options });

        const logWatch = (
            spec: K8sLogSpec,
            options?: K8sLogWatchOptions
        ): K8sLogWatch => {
            const {
                onLogLine = noop,
                onEnd = noop,
                ...otherOptions
            } = options ?? {};
            const subscription = ipcLogWatch(
                {
                    context,
                    spec,
                    options: otherOptions,
                },
                (error, logLines) => {
                    if (error) {
                        console.error("logWatch error: ", error);
                    }
                    if (logLines) {
                        if (logLines.length === 0) {
                            onEnd();
                        } else {
                            logLines.forEach(onLogLine);
                        }
                    }
                }
            );
            return {
                stop() {
                    subscription.stop();
                },
            };
        };

        const listPortForwards = () => ipcListPortForwards({ context });
        const portForward = (spec: K8sPortForwardSpec) =>
            ipcPortForward({ context, spec });
        const stopPortForward = (id: string) =>
            ipcStopPortForward({ context, id });
        const watchPortForwards = (
            watcher: K8sPortForwardWatcher
        ): { stop(): void } => {
            const subscription = ipcWatchPortForwards(
                { context },
                (err, message) => {
                    if (err) {
                        const unwrappedError = unwrapError(err);
                        watcher.onError(
                            unwrappedError,
                            (unwrappedError as any).portForwardId
                        );
                    }
                    if (message) {
                        switch (message.type) {
                            case "change":
                                watcher.onChange(message.value);
                                break;
                            case "start":
                                watcher.onStart(message.value);
                                break;
                            case "stop":
                                watcher.onStop(message.value);
                                break;
                            case "stats":
                                watcher.onStats(message.value);
                                break;
                        }
                    }
                }
            );
            return {
                stop() {
                    subscription.stop();
                },
            };
        };

        const getVersion = () => ipcGetVersion({ context });

        return {
            getContextLock,
            read,
            apply,
            patch,
            replace,
            redeploy,
            remove,
            list,
            listWatch,
            log,
            logWatch,
            exec,
            execCommand,
            listApiResourceTypes,
            listPortForwards,
            watchPortForwards,
            portForward,
            stopPortForward,
            getVersion,
        };
    }, [
        context,
        ipcRead,
        ipcApply,
        ipcPatch,
        ipcReplace,
        ipcRedeploy,
        ipcRemove,
        ipcList,
        ipcListWatch,
        ipcExec,
        ipcExecCommand,
        ipcLog,
        ipcLogWatch,
        ipcListPortForwards,
        ipcWatchPortForwards,
        ipcPortForward,
        ipcStopPortForward,
        ipcGetVersion,
    ]);

    return client;
}

function isListMessage<T extends K8sObject>(
    message: K8sPartialObjectListWatcherMessage<T>
): message is { list: K8sObjectList<T> } {
    return "list" in message;
}
