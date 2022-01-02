import * as k8s from "@kubernetes/client-node";
import { K8sClient, K8sContext } from "../../common/k8s/client";

import { createClient } from "./client";

export type K8sClientManager = {
    listContexts(): K8sContext[];
    clientForContext(context: string): K8sClient;
    defaultContext(): string | undefined;
    defaultNamespaces(): string[] | undefined;
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

    const clients: Record<string, K8sClient> = {};

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
            clients[context] = createClient(clientConfig);
        }
        return clients[context];
    };
    return {
        listContexts,
        clientForContext,
        defaultContext,
        defaultNamespaces,
    };
}
