import { createContext, useContext } from "react";
import { IpcCalls } from "../../types/ipc";

export const IpcContext = createContext((window as any).charm);

export function useIpcCalls(): IpcCalls {
    return useContext(IpcContext);
}
