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

export function useK8sVersion(opts?: {
    kubeContext?: string;
    pollInterval?: number;
    pauseOnHibernate?: boolean;
}): [boolean, K8sVersion | undefined, any | undefined] {
    const { pollInterval, pauseOnHibernate = true } = opts ?? {};

    const currentContext = useK8sContext();
    const kubeContext = opts?.kubeContext ?? currentContext;
    const client = useK8sClient(kubeContext);

    const [, , setKnownVersion] = useTempData(
        `k8s:lastKnownVersion:${kubeContext}`
    );
    const [, , setKnownVersionDate] = useTempData(
        `k8s:lastKnownVersionDate:${kubeContext}`
    );

    const getHibernate = useHibernateGetter();

    const { isLoading, version, error } = useSubscribedState(
        emptyState,
        (set) => {
            const rerender = !pauseOnHibernate || !getHibernate();

            async function update() {
                const version = await client.getVersion();
                set(
                    {
                        isLoading: false,
                        version,
                        error: undefined,
                    },
                    rerender
                );
                setKnownVersion(
                    `${version.major}.${version.minor} (${version.platform})`
                );
                setKnownVersionDate(formatDeveloperDate(new Date()));
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
        [
            client,
            getHibernate,
            pauseOnHibernate,
            pollInterval,
            setKnownVersion,
            setKnownVersionDate,
        ]
    );

    return [isLoading, version, error];
}
