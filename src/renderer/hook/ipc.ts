import { IpcCalls } from "../../types/ipc";

export function useIpc(): IpcCalls {
    return (window as any).charm;
}
