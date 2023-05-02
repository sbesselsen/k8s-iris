import React, { useCallback, useEffect, useState } from "react";
import { IDisposable, Terminal } from "xterm";
import { K8sExecHandler } from "../../../common/k8s/client";
import { XtermTerminal } from "../../component/terminal/XtermTerminal";
import { useIpcCall } from "../../hook/ipc";
import { useK8sClient } from "../../k8s/client";

export type PodShellEditorProps = {
    name: string;
    namespace: string;
    containerName: string;
};

export const PodShellEditor: React.FC<PodShellEditorProps> = (props) => {
    const { name, namespace, containerName } = props;

    const client = useK8sClient();
    const [terminal, setTerminal] = useState<Terminal>();

    const openInBrowser = useIpcCall((ipc) => ipc.app.openUrlInBrowser);
    const onClickLink = useCallback(
        (url) => {
            openInBrowser({ url });
        },
        [openInBrowser]
    );

    useEffect(() => {
        let handler: K8sExecHandler;
        let closed = false;
        let onData: IDisposable;
        let onBinary: IDisposable;

        if (!terminal) {
            return;
        }
        (async () => {
            try {
                handler = await client.exec({
                    namespace,
                    podName: name,
                    containerName,
                    command: [
                        "/bin/sh",
                        "-c",
                        "[ -x /bin/bash ] && /bin/bash || /bin/sh",
                    ],
                    tty: true,
                });
            } catch (e) {
                // TODO: show this nicely
                console.error(e);
                return;
            }
            if (closed) {
                handler.close();
                return;
            }
            handler.onReceive((stdout, stderr) => {
                if (stdout) {
                    terminal.write(new Uint8Array(stdout));
                }
                if (stderr) {
                    terminal.write(new Uint8Array(stderr));
                }
            });
            handler.onEnd(() => {
                terminal.writeln("\n\n(connection closed)");
            });

            handler.resizeTerminal({
                cols: terminal.cols,
                rows: terminal.rows,
            });

            const encoder = new TextEncoder();
            onBinary = terminal.onBinary((binary) => {
                const buffer = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; ++i) {
                    buffer[i] = binary.charCodeAt(i) & 255;
                }
                handler.send(buffer.buffer);
            });
            onData = terminal.onData((data) => {
                handler.send(encoder.encode(data));
            });
            terminal.onResize((size) => {
                handler.resizeTerminal(size);
            });
            terminal.focus();
        })();
        return () => {
            handler?.close();
            onData?.dispose();
            onBinary?.dispose();
            closed = true;
        };
    }, [client, name, namespace, containerName, terminal]);

    return (
        <XtermTerminal
            flex="1 0 0"
            onInitializeTerminal={setTerminal}
            onClickLink={onClickLink}
        />
    );
};
