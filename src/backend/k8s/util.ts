import { KubeConfig } from "@kubernetes/client-node";
import * as request from "request";
import { K8sFieldPredicate, K8sLabelPredicate } from "../../common/k8s/client";

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

export function labelSelectorToString(
    labelSelector: Array<K8sLabelPredicate>
): string {
    return labelSelector
        .map((selector) => {
            if (Array.isArray(selector.value)) {
                return selector.name + " in (" + selector.value.join(",") + ")";
            } else {
                return selector.name + "=" + selector.value;
            }
        })
        .join(",");
}

export function fieldSelectorToString(
    fieldSelector: Array<K8sFieldPredicate>
): string {
    return fieldSelector
        .map(
            (selector) =>
                selector.name +
                (selector.operator === "!=" ? "!=" : "==") +
                selector.value
        )
        .join(",");
}
