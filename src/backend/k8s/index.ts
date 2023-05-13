import * as k8s from "@kubernetes/client-node";
import { app } from "electron";
import { K8sClient, K8sContext } from "../../common/k8s/client";

import { createClient, K8sBackendClient } from "./client";

export type K8sClientManagerOptions = {
    kubeConfig?: k8s.KubeConfig;
    writableContexts?: string[];
};

export type K8sClientManager = {
    listContexts(): K8sContext[];
    watchContexts(
        watcher: (error: any, message?: undefined | K8sContext[]) => void
    ): { stop: () => void };
    clientForContext(context: string): K8sClient;
    defaultContext(): string | undefined;
    defaultNamespaces(): string[] | undefined;
    retryConnections(): void;
    kubeConfigForContext(context: string): k8s.KubeConfig;
};

function getKubeConfigFromDefault(): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    return kc;
}

export function createClientManager(
    opts: K8sClientManagerOptions = {}
): K8sClientManager {
    const kc = opts.kubeConfig ?? getKubeConfigFromDefault();

    const clients: Record<string, K8sBackendClient> = {};

    const listContexts = () => kc.getContexts();
    const watchContexts = (
        watcher: (error: any, message?: undefined | K8sContext[]) => void
    ) => {
        watcher(undefined, listContexts());
        const interval = setInterval(() => {
            // TODO: no! no!!!
            watcher(undefined, listContexts());
        }, 10000);
        return {
            stop() {
                // TODO
                clearInterval(interval);
            },
        };
    };
    const defaultContext = () => kc.getCurrentContext();
    const defaultNamespaces = () => {
        const context = defaultContext();
        if (context) {
            const namespace = kc.getContextObject(context)?.namespace;
            if (namespace) {
                return [namespace];
            }
        }
    };
    const clientForContext = (context: string) => {
        if (!clients[context]) {
            const clientConfig = new k8s.KubeConfig();
            clientConfig.loadFromString(kc.exportConfig());
            clientConfig.setCurrentContext(context);
            clients[context] = createClient(clientConfig, {
                getTempDirPath: () => app.getPath("temp"),
                readonly:
                    opts.writableContexts &&
                    !opts.writableContexts.includes(context),
            });
        }
        return clients[context];
    };
    const retryConnections = () => {
        for (const client of Object.values(clients)) {
            client.retryConnections();
        }
    };
    const kubeConfigForContext = (context: string) =>
        clientForContext(context).getKubeConfig();
    return {
        listContexts,
        watchContexts,
        clientForContext,
        defaultContext,
        defaultNamespaces,
        retryConnections,
        kubeConfigForContext,
    };
}
