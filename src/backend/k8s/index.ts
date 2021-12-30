import * as k8s from "@kubernetes/client-node";
import { Context } from "../../types/k8s";
import { createClient } from "./client";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export type K8sConnector = {
    availableContexts(): Promise<Context[]>;
};

export async function k8sConnector(): Promise<K8sConnector> {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    for (const context of kc.getContexts()) {
        if (context.name !== "colima") {
            throw new Error("Running against real clusters is not safe");
        }
    }

    const client = createClient(kc);

    console.log(
        (
            await client.list({
                apiVersion: "v1",
                kind: "Pod",
                namespace: "kube-system",
            })
        ).items.map((item) => item.metadata)
    );

    return {
        async availableContexts() {
            return kc.getContexts();
        },
    };
}
