import { useCallback, useEffect, useRef, useState } from "react";
import { IpcKvStore } from "../../common/ipc-types";
import { useIpcCall } from "./ipc";

export function useIpcKv<K = string, T = unknown>(
    prefix: string,
    key: K
): [boolean, T | undefined, (newValue: T | undefined) => void] {
    const renderedStateRef = useRef<{
        isLoading: boolean;
        value: T | undefined;
    }>({
        isLoading: true,
        value: undefined,
    });
    const [, setRenderIndex] = useState(0);

    const ipcWrite = useIpcCall(
        (ipc) => ((ipc as any)[prefix] as IpcKvStore<K, T>).write
    );
    const ipcDelete = useIpcCall(
        (ipc) => ((ipc as any)[prefix] as IpcKvStore<K, T>).delete
    );
    const ipcSubscribe = useIpcCall(
        (ipc) => ((ipc as any)[prefix] as IpcKvStore<K, T>).subscribe
    );

    const setter = useCallback(
        (newValue: T | undefined) => {
            if (newValue === undefined) {
                ipcDelete({ key });
            } else {
                ipcWrite({ key, value: newValue });
            }
            renderedStateRef.current = { isLoading: false, value: newValue };
            setRenderIndex((i) => i + 1);
        },
        [key, ipcDelete, ipcWrite, renderedStateRef, setRenderIndex]
    );

    useEffect(() => {
        const sub = ipcSubscribe({ key }, (err, message) => {
            if (message) {
                const { newValue } = message;
                if (
                    renderedStateRef.current.isLoading ||
                    renderedStateRef.current.value !== newValue
                ) {
                    renderedStateRef.current = {
                        isLoading: false,
                        value: newValue as T | undefined,
                    };
                    setRenderIndex((i) => i + 1);
                }
            }
        });
        return () => {
            sub.stop();
        };
    }, [key, renderedStateRef, setRenderIndex]);

    return [
        renderedStateRef.current.isLoading,
        renderedStateRef.current.value,
        setter,
    ];
}
