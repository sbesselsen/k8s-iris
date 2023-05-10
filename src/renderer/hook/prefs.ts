import { useCallback, useEffect, useRef, useState } from "react";
import { useIpcCall } from "./ipc";

export function usePref<T = unknown>(
    key: string
): [boolean, T | undefined, (newValue: T | undefined) => void] {
    const renderedStateRef = useRef<{
        isLoading: boolean;
        value: T | undefined;
    }>({
        isLoading: true,
        value: undefined,
    });
    const [, setRenderIndex] = useState(0);

    const prefsWrite = useIpcCall((ipc) => ipc.prefs.write);
    const prefsDelete = useIpcCall((ipc) => ipc.prefs.delete);
    const prefsSubscribe = useIpcCall((ipc) => ipc.prefs.subscribe);

    const setter = useCallback(
        (newValue: T | undefined) => {
            if (newValue === undefined) {
                prefsDelete({ key });
            } else {
                prefsWrite({ key, value: newValue });
            }
            renderedStateRef.current = { isLoading: false, value: newValue };
            setRenderIndex((i) => i + 1);
        },
        [key, prefsDelete, prefsWrite, renderedStateRef, setRenderIndex]
    );

    useEffect(() => {
        const sub = prefsSubscribe({ key }, (err, message) => {
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
