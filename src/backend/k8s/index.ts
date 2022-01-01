import * as k8s from "@kubernetes/client-node";
import { K8sContext } from "../../common/k8s/client";

export { createClient } from "./client";

const sharedKubeConfig = getKubeConfigFromDefault();

function getKubeConfigFromDefault(): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    return kc;
}

export async function listContexts(): Promise<K8sContext[]> {
    return sharedKubeConfig.getContexts();
}

export function getDefaultContext(): string | undefined {
    return sharedKubeConfig.getCurrentContext();
}

export function getDefaultNamespaces(): string[] | undefined {
    const defaultContext = sharedKubeConfig.getCurrentContext();
    if (defaultContext) {
        const defaultNamespace =
            sharedKubeConfig.getContextObject(defaultContext)?.namespace;
        if (defaultNamespace) {
            return [defaultNamespace];
        }
    }
}
