import { useEffect } from "react";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { create } from "../util/state";
import { useIpcCall } from "./ipc";

export type K8sContextsInfo = Array<
    K8sContext & { cloudInfo?: CloudK8sContextInfo }
>;

const { useStore: useContextsStore, useStoreValue: useContexts } = create<{
    loading: boolean;
    info: K8sContextsInfo;
    numWatchers: number;
    stopWatching?: undefined | (() => void);
}>({
    loading: false,
    numWatchers: 0,
    info: [],
});

export function useK8sContextsInfo(): [boolean, K8sContextsInfo] {
    const { loading, info } = useContexts();
    const store = useContextsStore();

    const watchContexts = useIpcCall((ipc) => ipc.k8s.watchContexts);

    const augmentK8sContexts = useIpcCall(
        (ipc) => ipc.cloud.augmentK8sContexts
    );

    useEffect(() => {
        store.set((v) => {
            const newValue = { ...v };
            newValue.numWatchers++;
            if (v.numWatchers === 1) {
                // We are the first watcher.
                const { stop } = watchContexts({}, async (err, contexts) => {
                    if (err) {
                        console.error("Error from watchContexts", err);
                    }
                    if (!contexts) {
                        return;
                    }

                    const cloudInfos = await augmentK8sContexts(contexts);

                    store.set((state) => ({
                        ...state,
                        loading: false,
                        info: contexts.map((ctx) => ({
                            ...ctx,
                            cloudInfo: cloudInfos[ctx.name],
                        })),
                    }));
                });
                newValue.stopWatching = stop;
            }
            return newValue;
        });
        return () => {
            store.set((v) => {
                const newValue = { ...v };
                newValue.numWatchers--;
                if (newValue.numWatchers === 0 && v.stopWatching) {
                    // Stop watching for contexts.
                    v.stopWatching();
                    delete newValue.stopWatching;
                }
                return newValue;
            });
        };
    }, [store, watchContexts]);

    return [loading, info];
}
