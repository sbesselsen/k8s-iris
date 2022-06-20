import { ShellManager } from ".";
import { ipcProvideSocket } from "../../common/ipc/main";

export const wireShellIpc = (shellManager: ShellManager): void => {
    ipcProvideSocket(
        "shell:openForContext",
        async ({ context }: { context: string }, hooks) => {
            const shellHandler = await shellManager.shellForContext(context);

            shellHandler.onReceive((stdoutChunk, stderrChunk) => {
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
            shellHandler.onEnd((status) => {
                console.log("ShellHandler onEnd", status);
                hooks.close();
            });
            hooks.onClose(() => {
                shellHandler.close();
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
                        shellHandler.resizeTerminal({
                            cols: data.cols,
                            rows: data.rows,
                        });
                    }
                } else {
                    // Plain shell data.
                    shellHandler.send(message);
                }
            });
        }
    );
};
