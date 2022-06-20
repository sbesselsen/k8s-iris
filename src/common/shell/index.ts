export type ShellHandler = {
    onReceive: (
        listener: (
            stdout: ArrayBuffer | null,
            stderr: ArrayBuffer | null
        ) => void
    ) => void;
    onEnd: (listener: (exitCode?: number) => void) => void;
    resizeTerminal: (size: { cols: number; rows: number }) => void;
    send: (chunk: ArrayBuffer) => void;
    close: () => Promise<void>;
};
