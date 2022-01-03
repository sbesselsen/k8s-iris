import { IpcCalls } from "../../common/ipc-types";

export function useIpc(): IpcCalls {
    return (window as any).charm;
}
