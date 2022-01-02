import {
    K8sContext,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sRemoveOptions,
    K8sRemoveStatus,
} from "../common/k8s/client";

type K8sListUpdate<T extends K8sObject = K8sObject> = {
    list: K8sObjectList<T>;
    update?: K8sObjectListUpdate<T>;
};

export type IpcCalls = {
    k8s: {
        listContexts(): Promise<K8sContext[]>;
        read(params: {
            context: string;
            spec: K8sObject;
        }): Promise<K8sObject | null>;
        apply(params: { context: string; spec: K8sObject }): Promise<K8sObject>;
        patch(params: { context: string; spec: K8sObject }): Promise<K8sObject>;
        replace(params: {
            context: string;
            spec: K8sObject;
        }): Promise<K8sObject>;
        remove(params: {
            context: string;
            spec: K8sObject;
            options?: K8sRemoveOptions;
        }): Promise<K8sRemoveStatus>;
        list<T extends K8sObject = K8sObject>(params: {
            context: string;
            spec: K8sObjectListQuery;
        }): Promise<K8sObjectList<T>>;
        listWatch<T extends K8sObject = K8sObject>(
            params: {
                context: string;
                spec: K8sObjectListQuery;
            },
            watcher: (update: K8sListUpdate<T>) => void
        ): { stop: () => void };
    };
};
