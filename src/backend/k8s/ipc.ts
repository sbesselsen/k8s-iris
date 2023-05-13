import { K8sClientManager } from "./index";
import {
    ipcHandle,
    ipcProvideSocket,
    ipcProvideSubscription,
} from "../../common/ipc/main";
import {
    K8sApplyOptions,
    K8sContext,
    K8sExecCommandOptions,
    K8sExecCommandSpec,
    K8sExecOptions,
    K8sExecSpec,
    K8sLogOptions,
    K8sLogSpec,
    K8sLogWatchOptions,
    K8sObject,
    K8sObjectListQuery,
    K8sPatchOptions,
    K8sPortForwardSpec,
    K8sRemoveOptions,
} from "../../common/k8s/client";
import { K8sPartialObjectListWatcher } from "../../common/ipc-types";

export const wireK8sClientIpc = (clientManager: K8sClientManager): void => {
    ipcHandle("k8s:listContexts", () => clientManager.listContexts());
    ipcProvideSubscription(
        "k8s:watchContexts",
        (_, send: (error: any, message?: undefined | K8sContext[]) => void) =>
            clientManager.watchContexts(send)
    );
    ipcHandle(
        "k8s:client:read",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).read(spec)
    );
    ipcHandle(
        "k8s:client:apply",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sObject;
            options: K8sApplyOptions;
        }) => clientManager.clientForContext(context).apply(spec, options)
    );
    ipcHandle(
        "k8s:client:patch",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sObject;
            options: K8sPatchOptions;
        }) => clientManager.clientForContext(context).patch(spec, options)
    );
    ipcHandle(
        "k8s:client:remove",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sObject;
            options: K8sRemoveOptions;
        }) => clientManager.clientForContext(context).remove(spec, options)
    );
    ipcHandle(
        "k8s:client:replace",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).patch(spec)
    );
    ipcHandle(
        "k8s:client:redeploy",
        async ({ context, spec }: { context: string; spec: K8sObject }) =>
            clientManager.clientForContext(context).redeploy(spec)
    );
    ipcHandle(
        "k8s:client:list",
        async ({
            context,
            spec,
        }: {
            context: string;
            spec: K8sObjectListQuery;
        }) => clientManager.clientForContext(context).list(spec)
    );
    ipcProvideSocket(
        "k8s:client:exec",
        async (
            {
                context,
                spec,
                options,
            }: { context: string; spec: K8sExecSpec; options: K8sExecOptions },
            hooks
        ) => {
            const client = clientManager.clientForContext(context);
            const execHandler = await client.exec(spec, options);

            execHandler.onReceive((stdoutChunk, stderrChunk) => {
                if (stdoutChunk) {
                    const newBuffer = new ArrayBuffer(
                        stdoutChunk.byteLength + 1
                    );
                    const intArray = new Uint8Array(newBuffer);
                    intArray[0] = 0;
                    intArray.set(new Uint8Array(stdoutChunk), 1);
                    hooks.send(newBuffer);
                }
                if (stderrChunk) {
                    const newBuffer = new ArrayBuffer(
                        stderrChunk.byteLength + 1
                    );
                    const intArray = new Uint8Array(newBuffer);
                    intArray[0] = 1;
                    intArray.set(new Uint8Array(stderrChunk), 1);
                    hooks.send(newBuffer);
                }
            });
            execHandler.onEnd((status) => {
                console.log("ExecHandler onEnd", status);
                hooks.close();
            });
            hooks.onClose(() => {
                execHandler.close();
            });
            hooks.onMessage((message) => {
                if (typeof message === "string") {
                    // Side channel data.
                    let data: any;
                    try {
                        data = JSON.parse(message);
                    } catch (e) {
                        console.error("Invalid side channel data", message);
                    }
                    if (
                        data.cmd === "resizeTerminal" &&
                        typeof data.cols === "number" &&
                        typeof data.rows === "number"
                    ) {
                        execHandler.resizeTerminal({
                            cols: data.cols,
                            rows: data.rows,
                        });
                    }
                } else {
                    // Plain shell data.
                    execHandler.send(message);
                }
            });
        }
    );
    ipcHandle(
        "k8s:client:execCommand",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sExecCommandSpec;
            options: K8sExecCommandOptions;
        }) => clientManager.clientForContext(context).execCommand(spec, options)
    );
    ipcHandle(
        "k8s:client:log",
        async ({
            context,
            spec,
            options,
        }: {
            context: string;
            spec: K8sLogSpec;
            options: K8sLogOptions;
        }) => clientManager.clientForContext(context).log(spec, options)
    );
    ipcProvideSubscription(
        "k8s:client:listWatch",
        (
            {
                context,
                spec,
            }: {
                context: string;
                spec: K8sObjectListQuery;
            },
            send: K8sPartialObjectListWatcher
        ) => {
            let didSendInitialList = false;
            let lastMessageWasError = false;
            const listWatch = clientManager
                .clientForContext(context)
                .listWatch(spec, (error, message) => {
                    if (error) {
                        send(error);
                        lastMessageWasError = true;
                        return;
                    }
                    if (!message) {
                        send(
                            new Error(
                                "Unknown listWatch error: no message and no error"
                            )
                        );
                        return;
                    }
                    if (!didSendInitialList || lastMessageWasError) {
                        send(undefined, { list: message.list });
                        didSendInitialList = true;
                        lastMessageWasError = false;
                    }
                    if (message.update) {
                        send(undefined, { update: message.update });
                        lastMessageWasError = false;
                    }
                });
            return {
                stop() {
                    listWatch.stop();
                },
            };
        }
    );
    ipcProvideSubscription(
        "k8s:client:logWatch",
        (
            {
                context,
                spec,
                options,
            }: {
                context: string;
                spec: K8sLogSpec;
                options: Omit<K8sLogWatchOptions, "onLogLine" | "onEnd">;
            },
            send
        ) => {
            const onLogLine = (line: string) => {
                send(undefined, [line]);
            };
            const onEnd = () => {
                send(undefined, []);
            };
            const logWatch = clientManager
                .clientForContext(context)
                .logWatch(spec, { ...options, onLogLine, onEnd });
            return {
                stop() {
                    logWatch.stop();
                },
            };
        }
    );
    ipcHandle(
        "k8s:client:listApiResourceTypes",
        async ({ context }: { context: string }) =>
            clientManager.clientForContext(context).listApiResourceTypes()
    );
    ipcHandle(
        "k8s:client:listPortForwards",
        async ({ context }: { context: string }) =>
            clientManager.clientForContext(context).listPortForwards()
    );
    ipcProvideSubscription(
        "k8s:client:watchPortForwards",
        (
            {
                context,
            }: {
                context: string;
            },
            send
        ) => {
            const watch = clientManager
                .clientForContext(context)
                .watchPortForwards({
                    onChange(forwards) {
                        send(undefined, {
                            type: "change",
                            value: forwards,
                        });
                    },
                    onStart(entry) {
                        send(undefined, {
                            type: "start",
                            value: entry,
                        });
                    },
                    onStop(entry) {
                        send(undefined, {
                            type: "stop",
                            value: entry,
                        });
                    },
                    onStats(stats) {
                        send(undefined, {
                            type: "stats",
                            value: stats,
                        });
                    },
                    onError(err, portForwardId) {
                        err.portForwardId = portForwardId;
                        send(err, undefined);
                    },
                });
            return {
                stop() {
                    watch.stop();
                },
            };
        }
    );
    ipcHandle(
        "k8s:client:portForward",
        async ({
            context,
            spec,
        }: {
            context: string;
            spec: K8sPortForwardSpec;
        }) => clientManager.clientForContext(context).portForward(spec)
    );
    ipcHandle(
        "k8s:client:stopPortForward",
        async ({ context, id }: { context: string; id: string }) =>
            clientManager.clientForContext(context).stopPortForward(id)
    );
    ipcHandle(
        "k8s:client:getVersion",
        async ({ context }: { context: string }) =>
            clientManager.clientForContext(context).getVersion()
    );
};
