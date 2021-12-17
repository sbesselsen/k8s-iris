import { Context } from "./k8s";

export type IpcCalls = {
    k8s: {
        availableContexts(): Promise<Context[]>;
    };
};
