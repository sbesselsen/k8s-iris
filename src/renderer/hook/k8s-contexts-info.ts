import { useEffect, useRef } from "react";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { create } from "../util/state";
import { useIpc } from "./ipc";

export type K8sContextsInfo = Array<
    K8sContext & { cloudInfo?: CloudK8sContextInfo }
>;

const [useContextsStore, useContexts] = create<{
    loading: boolean;
    initialized: boolean;
    info: K8sContextsInfo;
}>({
    loading: false,
    initialized: false,
    info: [],
});

export function useK8sContextsInfo(
    refresh?: boolean
): [boolean, K8sContextsInfo] {
    const { loading, initialized, info } = useContexts();
    const store = useContextsStore();

    const didRefreshRef = useRef(false);

    const ipc = useIpc();

    useEffect(() => {
        const shouldRefresh = refresh && !didRefreshRef.current;
        if (initialized && !shouldRefresh) {
            return;
        }
        didRefreshRef.current = true;

        // Initialize.
        store.set((state) => ({ ...state, loading: true, initialized: true }));
        (async () => {
            console.log("Loading here");
            const contexts = await ipc.k8s.listContexts();
            const cloudInfos = await ipc.cloud.augmentK8sContexts(contexts);

            store.set((state) => ({
                ...state,
                loading: false,
                info: contexts.map((ctx) => ({
                    ...ctx,
                    cloudInfo: cloudInfos[ctx.name],
                })),
            }));
        })();
    }, [ipc, initialized]);

    return [loading, info];
}
