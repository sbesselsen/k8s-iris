import { useMemo, useRef } from "react";
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
import { useKubeContext } from "../context/kube-context";
import { useIpc } from "../hook/ipc";

export function useK8sClient(kubeContext?: string): K8sClient {
    const sharedKubeContext = useKubeContext();
    const context = kubeContext ?? sharedKubeContext;

    const ipc = useIpc();
    const listWatchesRef = useRef<K8sObjectListWatch[]>([]);

    const client = useMemo(() => {
        // We are creating a new client. If we still have list watches on the previous client, stop them.
        listWatchesRef.current.forEach((lw) => lw.stop());
        listWatchesRef.current = [];

        const read = (spec: K8sObject) => ipc.k8s.read({ context, spec });
        const apply = (spec: K8sObject) => ipc.k8s.apply({ context, spec });
        const patch = (spec: K8sObject) => ipc.k8s.patch({ context, spec });
        const replace = (spec: K8sObject) => ipc.k8s.replace({ context, spec });
        const remove = (spec: K8sObject, options?: K8sRemoveOptions) =>
            ipc.k8s.remove({ context, spec, options });
        const list = <T extends K8sObject = K8sObject>(
            spec: K8sObjectListQuery
        ) => ipc.k8s.list<T>({ context, spec });
        const listWatch = async <T extends K8sObject = K8sObject>(
            spec: K8sObjectListQuery,
            watcher: K8sObjectListWatcher<T>
        ) => {
            let objectList: K8sObjectList<T>;

            // Subscribe to list updates.
            const subscription = ipc.k8s.listWatch(
                { context, spec },
                (message) => {
                    if (message.update !== undefined) {
                        // Process the update.
                        const update = message.update as K8sObjectListUpdate<T>;
                        const { type, object } = update;
                        switch (type) {
                            case "add":
                                objectList = addListObject(objectList, object);
                                watcher(objectList, update);
                                break;
                            case "remove":
                                objectList = deleteListObject(
                                    objectList,
                                    object
                                );
                                watcher(objectList, update);
                                break;
                            case "update":
                                objectList = updateListObject(
                                    objectList,
                                    object
                                );
                                watcher(objectList, update);
                                break;
                        }
                    } else {
                        objectList = message.list as K8sObjectList<T>;
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
    }, [context, ipc]);

    return client;
}
