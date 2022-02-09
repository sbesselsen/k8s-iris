import { KubeConfig } from "@kubernetes/client-node";
import * as request from "request";

export async function kubeRequestOpts(
    kubeConfig: KubeConfig
): Promise<request.CoreOptions> {
    const opts: request.CoreOptions = {};
    try {
        await kubeConfig.applyToRequest(opts as request.Options);
    } catch (e) {
        e.isKubeConfigRequestError = true;
        throw e;
    }
    return opts;
}
