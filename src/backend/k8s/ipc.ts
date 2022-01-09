import { K8sClientManager } from "./index";
import { ipcHandle, ipcProvideSubscription } from "../../common/ipc/main";
import {
    K8sObject,
    K8sObjectListQuery,
    K8sObjectListWatch,
} from "../../common/k8s/client";

export const wireK8sClientIpc = (clientManager: K8sClientManager): void => {
    ipcHandle("k8s:listContexts", () => clientManager.listContexts());
    ipcHandle(
        "k8s:client:read",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).read(spec)
    );
    ipcHandle(
        "k8s:client:apply",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).apply(spec)
    );
    ipcHandle(
        "k8s:client:patch",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).patch(spec)
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
            send
        ) => clientManager.clientForContext(context).listWatch(spec, send)
    );
};
