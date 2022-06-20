import { spawn } from "node-pty";
import { ShellHandler } from "../../common/shell";
import { bufferToArrayBuffer } from "../util/buffer";

export type ShellWrapper = (context: string) => Promise<ShellWrapperOutput>;

export type ShellWrapperOutput = {
    env?: Record<string, string>;
    unwrap: () => Promise<void>;
};

export type ShellManagerOptions = {
    shellWrappers: Array<ShellWrapper>;
};

export type ShellManager = {
    shellForContext(context: string): Promise<ShellHandler>;
};

export function createShellManager(opts: ShellManagerOptions): ShellManager {
    const shellForContext = async (context: string): Promise<ShellHandler> => {
        let closeListener: (exitCode: number) => void;

        const child = spawn(process.env.SHELL ?? "/bin/bash", [], {
            env: {
                TERM: "xterm-256color",
            },
            rows: 30,
            cols: 80,
        });

        child.onExit((exitData) => {
            console.log("on exit", exitData);
            closeListener?.(exitData.exitCode);
        });

        const handler: ShellHandler = {
            onReceive(listener) {
                child.onData((data) => {
                    listener(
                        bufferToArrayBuffer(Buffer.from(data, "utf8")),
                        null
                    );
                });
            },
            onEnd(listener) {
                closeListener = listener;
            },
            resizeTerminal(size) {
                child.resize(size.cols, size.rows);
            },
            send(chunk) {
                child.write(Buffer.from(chunk).toString("utf8"));
            },
            async close() {
                return new Promise((resolve) => {
                    child.onExit(() => {
                        resolve();
                    });
                    child.kill();
                });
            },
        };

        return handler;
    };
    return { shellForContext };
}
