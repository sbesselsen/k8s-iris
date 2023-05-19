import React, { useCallback, useEffect, useState } from "react";
import { IDisposable, Terminal } from "xterm";
import { ShellHandler } from "../../../common/shell";
import { XtermTerminal } from "../../component/terminal/XtermTerminal";
import { useIpcCall } from "../../hook/ipc";
import { useLocalShellOpener } from "../../shell";

export const LocalShellEditor: React.FC<{}> = () => {
    const [terminal, setTerminal] = useState<Terminal>();
    const openShell = useLocalShellOpener();

    const openInBrowser = useIpcCall((ipc) => ipc.app.openUrlInBrowser);
    const onClickLink = useCallback(
        (url: string) => {
            openInBrowser({ url });
        },
        [openInBrowser]
    );

    useEffect(() => {
        let handler: ShellHandler;
        let closed = false;
        let onData: IDisposable;
        let onBinary: IDisposable;

        if (!terminal) {
            return;
        }
        (async () => {
            try {
                handler = await openShell();
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
                terminal.writeln("\n\n(shell closed)");
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
    }, [terminal]);

    return (
        <XtermTerminal
            flex="1 0 0"
            onInitializeTerminal={setTerminal}
            onClickLink={onClickLink}
        />
    );
};
