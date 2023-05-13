import { CloudK8sContextInfo } from "../cloud/k8s";
import {
    ContextMenuOptions,
    ContextMenuResult,
    ContextMenuTemplate,
} from "../contextmenu";
import { IpcRendererSocketHooks } from "../ipc/renderer";
import {
    K8sApplyOptions,
    K8sContext,
    K8sExecCommandOptions,
    K8sExecCommandResult,
    K8sExecCommandSpec,
    K8sLogOptions,
    K8sLogResult,
    K8sLogSpec,
    K8sLogWatchOptions,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sObjectListUpdate,
    K8sPatchOptions,
    K8sPortForwardEntry,
    K8sPortForwardSpec,
    K8sRemoveOptions,
    K8sRemoveStatus,
    K8sResourceTypeInfo,
    K8sVersion,
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

export type IpcKvStore<K = string, V = unknown> = {
    read(params: { key: K }): Promise<V>;
    write(params: { key: K; value: V }): Promise<void>;
    delete(params: { key: K }): Promise<V>;
    subscribe(
        params: { key: K },
        receive: (error: any, message?: undefined | { newValue: V }) => void
    ): { stop: () => void };
};

export type IpcCalls = {
    app: {
        createWindow(parameters?: { route?: AppRoute }): Promise<void>;
        onWindowFocusChange(handler: (data: boolean) => void): {
            stop: () => void;
        };
        showDialog(options: DialogOptions): Promise<DialogResult>;
        openUrlInBrowser(params: { url: string }): Promise<void>;
    };
    cloud: {
        augmentK8sContexts(
            contexts: K8sContext[]
        ): Promise<Record<string, CloudK8sContextInfo>>;
        loginForContext(context: K8sContext): Promise<void>;
    };
    k8s: {
        listContexts(): Promise<K8sContext[]>;
        watchContexts(
            params: {},
            receive: (error: any, message?: undefined | K8sContext[]) => void
        ): { stop: () => void };
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
        redeploy(params: { context: string; spec: K8sObject }): Promise<void>;
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
        exec(params: {
            context: string;
            spec: K8sExecCommandSpec;
            options: K8sExecCommandOptions;
        }): Promise<IpcRendererSocketHooks>;
        execCommand(params: {
            context: string;
            spec: K8sExecCommandSpec;
            options: K8sExecCommandOptions;
        }): Promise<K8sExecCommandResult>;
        listApiResourceTypes(params: {
            context: string;
        }): Promise<K8sResourceTypeInfo[]>;
        log(params: {
            context: string;
            spec: K8sLogSpec;
            options: K8sLogOptions;
        }): Promise<K8sLogResult>;
        logWatch(
            params: {
                context: string;
                spec: K8sLogSpec;
                options: Omit<K8sLogWatchOptions, "onLogLine" | "onEnd">;
            },
            receive: (error: any, logLines?: []) => void
        ): { stop: () => void };
        listPortForwards(params: {
            context: string;
        }): Promise<Array<K8sPortForwardEntry>>;
        watchPortForwards(
            params: {
                context: string;
            },
            receive: (
                error: any,
                message?: undefined | { type: string; value: any }
            ) => void
        ): { stop: () => void };
        portForward(params: {
            context: string;
            spec: K8sPortForwardSpec;
        }): Promise<K8sPortForwardEntry>;
        stopPortForward(params: { context: string; id: string }): Promise<void>;
        getVersion(params: { context: string }): Promise<K8sVersion>;
    };
    contextLock: {
        set(params: { context: string; locked: boolean }): Promise<void>;
        watch(
            params: {
                context: string;
            },
            receive: (
                error: any,
                message?: undefined | { locked: boolean }
            ) => void
        ): { stop: () => void };
    };
    shell: {
        openForContext(params: {
            context: string;
        }): Promise<IpcRendererSocketHooks>;
    };
    appearance: {
        getAccentColor(): Promise<string>;
        watchAccentColor(
            params: undefined,
            receive: (error: any, message?: undefined | string) => void
        ): { stop: () => void };
    };
    contextMenu: {
        popup(params: {
            menuTemplate: ContextMenuTemplate;
            options?: ContextMenuOptions;
        }): Promise<ContextMenuResult>;
    };
    prefs: IpcKvStore;
    tempData: IpcKvStore;
};
