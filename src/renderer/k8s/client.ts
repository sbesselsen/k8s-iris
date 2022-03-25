import { useEffect, useMemo, useRef } from "react";
import {
    addListObject,
    deleteListObject,
    updateListObject,
} from "../../common/k8s/util";
import {
    K8sClient,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sObjectListWatch,
    K8sObjectListWatcher,
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
        const apply = (spec: K8sObject) => {
            if (isLockedRef.current) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcApply({ context, spec });
        };
        const patch = (spec: K8sObject) => {
            if (isLockedRef.current) {
                throw new ContextLockedError("Cluster is locked");
            }
            return ipcPatch({ context, spec });
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

        return {
            read,
            apply,
            patch,
            replace,
            remove,
            list,
            listWatch,
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
    ]);

    return client;
}

function isListMessage<T extends K8sObject>(
    message: K8sPartialObjectListWatcherMessage<T>
): message is { list: K8sObjectList<T> } {
    return "list" in message;
}
