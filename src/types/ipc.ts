import { K8sContext } from "../common/k8s/client";

export type IpcCalls = {
    k8s: {
        listContexts(): Promise<K8sContext[]>;
    };
};
