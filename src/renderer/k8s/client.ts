import { useEffect, useMemo, useRef } from "react";
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
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
    K8sObjectListWatcher,
    K8sPatchOptions,
    K8sRemoveOptions,
} from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { useIpcCall } from "../hook/ipc";
import { unwrapError } from "../../common/ipc/shared";
import { K8sPartialObjectListWatcherMessage } from "../../common/ipc-types";
import { ContextLockedError, useContextLock } from "../context/context-lock";

export function useK8sClient(kubeContext?: string): K8sClient {
    const sharedKubeContext = useK8sContext();
    const context = kubeContext ?? sharedKubeContext;

    const ipcRead = useIpcCall((ipc) => ipc.k8s.read);
    const ipcApply = useIpcCall((ipc) => ipc.k8s.apply);
    const ipcPatch = useIpcCall((ipc) => ipc.k8s.patch);
    const ipcReplace = useIpcCall((ipc) => ipc.k8s.replace);
    const ipcRemove = useIpcCall((ipc) => ipc.k8s.remove);
    const ipcList = useIpcCall((ipc) => ipc.k8s.list);
    const ipcListWatch = useIpcCall((ipc) => ipc.k8s.listWatch);
    const ipcListApiResourceTypes = useIpcCall(
        (ipc) => ipc.k8s.listApiResourceTypes
    );
    const ipcExec = useIpcCall((ipc) => ipc.k8s.exec);
    const ipcExecCommand = useIpcCall((ipc) => ipc.k8s.execCommand);
    const listWatchesRef = useRef<K8sObjectListWatch[]>([]);

    const isLocked = useContextLock();
    const isLockedRef = useRef(isLocked);
    useEffect(() => {
        isLockedRef.current = isLocked;
    }, [isLocked, isLockedRef]);

    const client = useMemo(() => {
        // We are creating a new client. If we still have list watches on the previous client, stop them.
        listWatchesRef.current.forEach((lw) => lw.stop());
        listWatchesRef.current = [];

        const read = (spec: K8sObject) => ipcRead({ context, spec });
        const apply = (spec: K8sObject, options?: K8sApplyOptions) => {
            if (isLockedRef.current) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcApply({ context, spec, options });
        };
        const patch = (spec: K8sObject, options?: K8sPatchOptions) => {
            if (isLockedRef.current) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcPatch({ context, spec, options });
        };
        const replace = (spec: K8sObject) => {
            if (isLockedRef.current) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcReplace({ context, spec });
        };
        const remove = (spec: K8sObject, options?: K8sRemoveOptions) => {
            if (isLockedRef.current) {
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
            options?: K8sExecCommandOptions
        ) => ipcExecCommand({ context, spec, options });

        const exec = async (
            spec: K8sExecSpec,
            options?: K8sExecOptions
        ): Promise<K8sExecHandler> => {
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

        return {
            read,
            apply,
            patch,
            replace,
            remove,
            list,
            listWatch,
            exec,
            execCommand,
            listApiResourceTypes,
        };
    }, [
        context,
        ipcRead,
        ipcApply,
        ipcPatch,
        ipcReplace,
        ipcRemove,
        ipcList,
        ipcListWatch,
        ipcExec,
        ipcExecCommand,
    ]);

    return client;
}

function isListMessage<T extends K8sObject>(
    message: K8sPartialObjectListWatcherMessage<T>
): message is { list: K8sObjectList<T> } {
    return "list" in message;
}
