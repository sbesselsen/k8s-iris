import { CloudManager } from ".";
import { ipcHandle } from "../../common/ipc/main";
import { K8sContext } from "../../common/k8s/client";

export const wireCloudIpc = (cloudManager: CloudManager): void => {
    ipcHandle("cloud:augmentK8sContexts", (contexts: K8sContext[]) =>
        cloudManager.augmentK8sContexts(contexts)
    );
    ipcHandle("cloud:loginForContext", (context: K8sContext) =>
        cloudManager.loginForContext(context)
    );
};
