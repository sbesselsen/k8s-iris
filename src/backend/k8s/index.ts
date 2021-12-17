import * as k8s from "@kubernetes/client-node";
import { Context } from "../../types/k8s";

export type K8sConnector = {
    availableContexts(): Promise<Context[]>;
};

export async function k8sConnector(): Promise<K8sConnector> {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    return {
        async availableContexts() {
            return kc.getContexts();
        },
    };
}
