import { useRef } from "react";
import { IpcCalls } from "../../common/ipc-types";
import { unwrapError } from "../../common/ipc/shared";

export function useIpcCall<T extends (...args: any[]) => any>(
    f: (ipc: IpcCalls) => T
): T {
    const ipc: IpcCalls = (window as any).charm;
    const ipcFunction = f(ipc);
    // Abuse useRef to create a 100% certain constant.
    const callRef = useRef<T>(((...args) => {
        try {
            return ipcFunction(...args);
        } catch (e: any) {
            throw unwrapError(e);
        }
    }) as T);
    return callRef.current;
}
