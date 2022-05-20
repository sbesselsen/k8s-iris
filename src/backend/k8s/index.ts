import * as k8s from "@kubernetes/client-node";
import { app } from "electron";
import { K8sClient, K8sContext } from "../../common/k8s/client";

import { createClient, K8sBackendClient } from "./client";

export type K8sClientManager = {
    listContexts(): K8sContext[];
    clientForContext(context: string): K8sClient;
    defaultContext(): string | undefined;
    defaultNamespaces(): string[] | undefined;
    retryConnections(): void;
};

function getKubeConfigFromDefault(): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    return kc;
}

export function createClientManager(
    kubeConfig?: k8s.KubeConfig
): K8sClientManager {
    const kc = kubeConfig ?? getKubeConfigFromDefault();

    const clients: Record<string, K8sBackendClient> = {};

    const listContexts = () => kc.getContexts();
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
            });
        }
        return clients[context];
    };
    const retryConnections = () => {
        for (const client of Object.values(clients)) {
            client.retryConnections();
        }
    };
    return {
        listContexts,
        clientForContext,
        defaultContext,
        defaultNamespaces,
        retryConnections,
    };
}
