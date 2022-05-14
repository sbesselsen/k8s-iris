import { CloudK8sContextInfo } from "../cloud/k8s";
import {
    K8sApplyOptions,
    K8sContext,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sPatchOptions,
    K8sRemoveOptions,
    K8sRemoveStatus,
    K8sResourceTypeInfo,
} from "../k8s/client";
import { AppRoute } from "../route/app-route";
import { DialogOptions, DialogResult } from "../ui/dialog";

export type K8sPartialObjectListWatcherMessage<
    T extends K8sObject = K8sObject
> =
    | {
          list: K8sObjectList<T>;
      }
    | {
          update: K8sObjectListUpdate<T>;
      };

export type K8sPartialObjectListWatcher<T extends K8sObject = K8sObject> = (
    error: any | undefined,
    message?: K8sPartialObjectListWatcherMessage<T> | undefined
) => void;

export type IpcCalls = {
    app: {
        createWindow(parameters?: { route?: AppRoute }): Promise<void>;
        onWindowFocusChange(handler: (data: boolean) => void): {
            stop: () => void;
        };
        showDialog(options: DialogOptions): Promise<DialogResult>;
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
        apply(params: {
            context: string;
            spec: K8sObject;
            options: K8sApplyOptions;
        }): Promise<K8sObject>;
        patch(params: {
            context: string;
            spec: K8sObject;
            options: K8sPatchOptions;
        }): Promise<K8sObject>;
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
            watcher: K8sPartialObjectListWatcher<T>
        ): { stop: () => void };
        listApiResourceTypes(params: {
            context: string;
        }): Promise<K8sResourceTypeInfo[]>;
    };
};
