import { useCallback, useMemo } from "react";
import { K8sVersion } from "../../common/k8s/client";
import { useHibernateGetter } from "../context/hibernate";
import { useK8sContext } from "../context/k8s-context";
import { useSubscribedState } from "../hook/subscribed-state";
import { useTempData } from "../hook/temp-data";
import { formatDeveloperDate } from "../util/date";
import { useK8sClient } from "./client";

const emptyState: {
    isLoading: boolean;
    version: K8sVersion | undefined;
    error: any | undefined;
} = {
    isLoading: true,
    version: undefined,
    error: undefined,
};

export function useK8sVersionGetter(opts?: {
    kubeContext?: string;
    pollInterval?: number;
    pauseOnHibernate?: boolean;
}): () => Promise<K8sVersion> {
    const currentContext = useK8sContext();
    const kubeContext = opts?.kubeContext ?? currentContext;
    const client = useK8sClient(kubeContext);

    const [, , setKnownVersion] = useTempData(
        `k8s:lastKnownVersion:${kubeContext}`
    );
    const [, , setKnownVersionDate] = useTempData(
        `k8s:lastKnownVersionDate:${kubeContext}`
    );

    return useCallback(async () => {
        const version = await client.getVersion();

        setKnownVersion(
            `${version.major}.${version.minor} (${version.platform})`
        );
        setKnownVersionDate(formatDeveloperDate(new Date()));

        return version;
    }, [client, kubeContext, setKnownVersion, setKnownVersionDate]);
}

export function useK8sVersion(opts?: {
    kubeContext?: string;
    pollInterval?: number;
    pauseOnHibernate?: boolean;
}): [boolean, K8sVersion | undefined, any | undefined] {
    const { pollInterval, pauseOnHibernate = true } = opts ?? {};

    const getVersion = useK8sVersionGetter(opts);

    const getHibernate = useHibernateGetter();

    const { isLoading, version, error } = useSubscribedState(
        emptyState,
        (set) => {
            const rerender = !pauseOnHibernate || !getHibernate();

            async function update() {
                let version: K8sVersion | undefined;
                let error: any | undefined;
                try {
                    version = await getVersion();
                } catch (e) {
                    error = e;
                }

                set(
                    {
                        isLoading: false,
                        version,
                        error,
                    },
                    rerender
                );
            }

            set(emptyState, rerender);
            update();

            if (pollInterval === undefined) {
                return () => {};
            }

            // Now start polling.
            const interval = setInterval(update, Math.max(1000, pollInterval));
            return () => {
                clearInterval(interval);
            };
        },
        [getVersion, getHibernate, pauseOnHibernate, pollInterval]
    );

    return [isLoading, version, error];
}

export type K8sCachedVersionEntry = {
    version: string;
    date: string;
};

export function useLastKnownK8sVersion(opts?: {
    kubeContext?: string;
}): [boolean, K8sCachedVersionEntry | undefined] {
    const currentContext = useK8sContext();
    const kubeContext = opts?.kubeContext ?? currentContext;

    const [isLoadingVersion, knownVersion] = useTempData(
        `k8s:lastKnownVersion:${kubeContext}`
    );
    const [isLoadingVersionData, knownVersionDate] = useTempData(
        `k8s:lastKnownVersionDate:${kubeContext}`
    );

    return useMemo(() => {
        if (isLoadingVersion || isLoadingVersionData) {
            return [true, undefined];
        }
        if (
            typeof knownVersion !== "string" ||
            typeof knownVersionDate !== "string"
        ) {
            return [false, undefined];
        }
        return [
            false,
            {
                version: knownVersion,
                date: knownVersionDate,
            },
        ];
    }, [
        isLoadingVersion,
        isLoadingVersionData,
        knownVersion,
        knownVersionDate,
    ]);
}
