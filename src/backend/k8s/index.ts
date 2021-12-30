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

    await client.apply({
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
            name: "k8s-client-demo",
            labels: {
                aap: "schaap",
            },
        },
    });
    console.log(
        await client.read({
            apiVersion: "v1",
            kind: "Namespace",
            metadata: {
                name: "k8s-client-demo",
            },
        })
    );
    await client.remove({
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
            name: "k8s-client-demo",
        },
    });
    console.log(
        await client.read({
            apiVersion: "v1",
            kind: "Namespace",
            metadata: {
                name: "k8s-client-demo",
            },
        })
    );

    return {
        async availableContexts() {
            return kc.getContexts();
        },
    };
}
