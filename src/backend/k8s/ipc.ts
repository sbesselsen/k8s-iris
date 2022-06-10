import { K8sClientManager } from "./index";
import { ipcHandle, ipcProvideSubscription } from "../../common/ipc/main";
import {
    K8sApplyOptions,
    K8sExecCommandOptions,
    K8sExecCommandSpec,
    K8sObject,
    K8sObjectListQuery,
    K8sPatchOptions,
    K8sRemoveOptions,
} from "../../common/k8s/client";
import { K8sPartialObjectListWatcher } from "../../common/ipc-types";

export const wireK8sClientIpc = (clientManager: K8sClientManager): void => {
    ipcHandle("k8s:listContexts", () => clientManager.listContexts());
    ipcHandle(
        "k8s:client:read",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).read(spec)
    );
    ipcHandle(
        "k8s:client:apply",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sObject;
            options: K8sApplyOptions;
        }) => clientManager.clientForContext(context).apply(spec, options)
    );
    ipcHandle(
        "k8s:client:patch",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sObject;
            options: K8sPatchOptions;
        }) => clientManager.clientForContext(context).patch(spec, options)
    );
    ipcHandle(
        "k8s:client:remove",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sObject;
            options: K8sRemoveOptions;
        }) => clientManager.clientForContext(context).remove(spec, options)
    );
    ipcHandle(
        "k8s:client:replace",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).patch(spec)
    );
    ipcHandle(
        "k8s:client:list",
        async ({
            context,
            spec,
        }: {
            context: string;
            spec: K8sObjectListQuery;
        }) => clientManager.clientForContext(context).list(spec)
    );
    ipcHandle(
        "k8s:client:execCommand",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sExecCommandSpec;
            options: K8sExecCommandOptions;
        }) => clientManager.clientForContext(context).execCommand(spec, options)
    );
    ipcProvideSubscription(
        "k8s:client:listWatch",
        (
            {
                context,
                spec,
            }: {
                context: string;
                spec: K8sObjectListQuery;
            },
            send: K8sPartialObjectListWatcher
        ) => {
            let didSendInitialList = false;
            let lastMessageWasError = false;
            const listWatch = clientManager
                .clientForContext(context)
                .listWatch(spec, (error, message) => {
                    if (error) {
                        send(error);
                        lastMessageWasError = true;
                    } else {
                        if (!didSendInitialList || lastMessageWasError) {
                            send(undefined, { list: message.list });
                            didSendInitialList = true;
                            lastMessageWasError = false;
                        }
                        if (message.update) {
                            send(undefined, { update: message.update });
                            lastMessageWasError = false;
                        }
                    }
                });
            return {
                stop() {
                    listWatch.stop();
                },
            };
        }
    );
    ipcHandle(
        "k8s:client:listApiResourceTypes",
        async ({ context }: { context: string }) =>
            clientManager.clientForContext(context).listApiResourceTypes()
    );
};
