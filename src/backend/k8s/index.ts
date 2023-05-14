import * as k8s from "@kubernetes/client-node";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { K8sClient, K8sContext } from "../../common/k8s/client";

import { createClient, K8sBackendClient } from "./client";

export type K8sClientManagerOptions = {
    kubeConfig?: k8s.KubeConfig;
    writableContexts?: string[];
};

export type K8sClientManager = {
    listContexts(): K8sContext[];
    watchContexts(
        watcher: (error: any, message?: undefined | K8sContext[]) => void
    ): { stop: () => void };
    clientForContext(context: string): K8sClient;
    defaultContext(): string | undefined;
    defaultNamespaces(): string[] | undefined;
    retryConnections(): void;
    kubeConfigForContext(context: string): k8s.KubeConfig;
};

function getKubeConfigFromDefault(): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    return kc;
}

function getKubeConfigPaths(): string[] {
    if (process.env.KUBECONFIG && process.env.KUBECONFIG.length > 0) {
        return process.env.KUBECONFIG.split(path.delimiter).filter(
            (filename: string) => filename
        );
    }

    function findHomeDir(): string | null {
        if (process.env.HOME) {
            try {
                fs.accessSync(process.env.HOME);
                return process.env.HOME;
            } catch (ignore) {
                // Ignore.
            }
        }
        return null;
    }

    const home = findHomeDir();
    if (home) {
        const config = path.join(home, ".kube", "config");
        if (fs.existsSync(config)) {
            return [config];
        }
    }

    return [];
}

export function createClientManager(
    opts: K8sClientManagerOptions = {}
): K8sClientManager {
    let kc = opts.kubeConfig ?? getKubeConfigFromDefault();

    const clients: Record<string, K8sBackendClient> = {};

    let kubeConfigListeners: Array<() => void> = [];

    if (!opts.kubeConfig) {
        // Using the system-default kubeConfig.
        // Listen to changes to our kubeConfig and propagate them immediately.
        for (const kubeConfigPath of getKubeConfigPaths()) {
            console.log("Monitoring kube config at: ", kubeConfigPath);
            fs.watch(kubeConfigPath, null, (eventType) => {
                if (eventType === "change") {
                    console.log(
                        "Reloading kube config due to change: ",
                        kubeConfigPath
                    );

                    // Reload kubeConfig.
                    kc = getKubeConfigFromDefault();

                    // Notify listeners.
                    kubeConfigListeners.forEach((l) => l());
                }
            });
        }
    }

    const listContexts = () => kc.getContexts();
    const watchContexts = (
        watcher: (error: any, message?: undefined | K8sContext[]) => void
    ) => {
        watcher(undefined, listContexts());
        const listener = () => {
            watcher(undefined, listContexts());
        };
        kubeConfigListeners.push(listener);
        return {
            stop() {
                kubeConfigListeners = kubeConfigListeners.filter(
                    (l) => l !== listener
                );
            },
        };
    };
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
                readonly:
                    opts.writableContexts &&
                    !opts.writableContexts.includes(context),
            });
        }
        return clients[context];
    };
    const retryConnections = () => {
        for (const client of Object.values(clients)) {
            client.retryConnections();
        }
    };
    const kubeConfigForContext = (context: string) =>
        clientForContext(context).getKubeConfig();
    return {
        listContexts,
        watchContexts,
        clientForContext,
        defaultContext,
        defaultNamespaces,
        retryConnections,
        kubeConfigForContext,
    };
}
