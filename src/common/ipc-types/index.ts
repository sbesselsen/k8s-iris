import { CloudK8sContextInfo } from "../cloud/k8s";
import {
    K8sContext,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListWatcher,
    K8sRemoveOptions,
    K8sRemoveStatus,
} from "../k8s/client";

export type IpcCalls = {
    app: {
        createWindow(parameters?: {
            context?: string;
            namespaces?: string[];
        }): Promise<void>;
        onWindowFocusChange(handler: (data: boolean) => void): {
            stop: () => void;
        };
    };
    cloud: {
        augmentK8sContexts(
            contexts: K8sContext[]
        ): Promise<Record<string, CloudK8sContextInfo>>;
        loginForContext(context: K8sContext): Promise<void>;
    };
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
            watcher: K8sObjectListWatcher<T>
        ): { stop: () => void };
    };
};
