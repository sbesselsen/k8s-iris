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
        ) => {
            let stopped = false;
            let subscription: K8sObjectListWatch | undefined;
            (async () => {
                try {
                    subscription = await clientManager
                        .clientForContext(context)
                        .listWatch(spec, (error, message) => {
                            if (stopped) {
                                // Race condition: stop() was called before the first update. Stop here.
                                subscription.stop();
                                return;
                            }
                            send(error, message);
                        });
                } catch (e) {
                    // Send the error to the client.
                    send(e, undefined);
                    stopped = true;
                }
            })();
            return {
                stop() {
                    stopped = true;
                    if (subscription) {
                        subscription.stop();
                    }
                },
            };
        }
    );
};
