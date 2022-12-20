import { useCallback, useEffect, useState } from "react";
import { K8sVersion } from "../../common/k8s/client";
import { useHibernate } from "../context/hibernate";
import { useK8sContext } from "../context/k8s-context";
import { useK8sClient } from "./client";

export function useK8sVersion(opts?: {
    kubeContext?: string;
    pollInterval?: number;
    pauseOnHibernate?: boolean;
}): [boolean, K8sVersion | undefined, any | undefined, () => void] {
    const { pollInterval, pauseOnHibernate = true } = opts ?? {};

    const currentContext = useK8sContext();
    const kubeContext = opts?.kubeContext ?? currentContext;
    const client = useK8sClient(kubeContext);

    const [{ isLoading, version, error }, setState] = useState<{
        isLoading: boolean;
        version: K8sVersion | undefined;
        error: any | undefined;
    }>({
        isLoading: true,
        version: undefined,
        error: undefined,
    });

    const reloadInner = useCallback(
        async (showAsLoading: boolean) => {
            if (showAsLoading) {
                setState({
                    isLoading: true,
                    version: undefined,
                    error: undefined,
                });
            }
            try {
                const version = await client.getVersion();
                setState({ isLoading: false, version, error: undefined });
            } catch (e) {
                setState({ isLoading: false, version: undefined, error: e });
            }
        },
        [client, setState]
    );

    const reload = useCallback(async () => {
        reloadInner(true);
    }, [reloadInner]);

    useEffect(() => {
        reload();
    }, [client, reload]);

    const hibernate = useHibernate();

    useEffect(() => {
        if (pollInterval === undefined || (pauseOnHibernate && hibernate)) {
            return;
        }
        const interval = setInterval(() => {
            reloadInner(false);
        }, Math.max(1000, pollInterval));
        return () => {
            clearInterval(interval);
        };
    }, [hibernate, pauseOnHibernate, pollInterval, reloadInner]);

    return [isLoading, version, error, reload];
}
