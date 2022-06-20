import { ShellHandler } from "../../common/shell";
import { useK8sContext } from "../context/k8s-context";
import { useIpcCall } from "../hook/ipc";

export type OpenShellOptions = {
    context?: string;
};

export function useLocalShellOpener(): (
    opts?: OpenShellOptions
) => Promise<ShellHandler> {
    const localContext = useK8sContext();
    const ipcOpenShell = useIpcCall((ipc) => ipc.shell.openForContext);

    return async (opts) => {
        const context = opts?.context ?? localContext;

        const hooks = await ipcOpenShell({
            context,
        });
        return {
            onReceive: (listener) => {
                hooks.onMessage((message) => {
                    if (typeof message === "string") {
                        console.error(
                            "Invalid message in onReceive from exec()"
                        );
                        return;
                    }
                    const view = new Uint8Array(message);
                    if (view[0] === 0) {
                        // stdout
                        listener(message.slice(1), null);
                    } else {
                        // stderr
                        listener(null, message.slice(1));
                    }
                });
            },
            onEnd: (listener) => {
                hooks.onClose(listener);
            },
            send: (chunk) => {
                hooks.send(chunk);
            },
            resizeTerminal: (size) => {
                const { cols, rows } = size;
                hooks.send(
                    JSON.stringify({ cmd: "resizeTerminal", cols, rows })
                );
            },
            close: async () => {
                // TODO: should we await something here?
                hooks.close();
            },
        };
    };
}
