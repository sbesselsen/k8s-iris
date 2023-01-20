import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    K8sPortForwardEntry,
    K8sPortForwardStats,
    K8sPortForwardWatcher,
} from "../../common/k8s/client";
import { useHibernateGetter, useHibernateListener } from "../context/hibernate";
import { useK8sClient } from "./client";

const emptyWatcher: K8sPortForwardWatcher = {
    onChange() {},
    onError() {},
    onStart() {},
    onStats() {},
    onStop() {},
};

export type K8sPortForwardsOptions = Partial<K8sPortForwardWatcher> & {
    kubeContext?: string;
    pauseOnHibernate?: boolean;
};

const loadingValue: [boolean, K8sPortForwardEntry[], undefined] = [
    true,
    [],
    undefined,
];

export type K8sPortForwardsWatchOptions = {
    kubeContext?: string;
    pauseOnHibernate?: boolean;
    onStats?: (stats: Record<string, K8sPortForwardStats>) => void;
};

export function useK8sPortForwardsWatch(
    opts: K8sPortForwardsWatchOptions = {},
    deps: any[] = []
): [boolean, Array<K8sPortForwardEntry>, any | undefined] {
    const [state, setState] =
        useState<[boolean, Array<K8sPortForwardEntry>, any | undefined]>(
            loadingValue
        );
    useK8sPortForwardsListener(
        {
            ...opts,
            onChange(forwards) {
                setState([false, forwards, undefined]);
            },
        },
        [setState, ...deps]
    );

    const client = useK8sClient(opts.kubeContext);
    useEffect(() => {
        let canceled = false;
        (async () => {
            let forwards: K8sPortForwardEntry[];
            try {
                forwards = await client.listPortForwards();
            } catch (e) {
                if (!canceled) {
                    setState([false, [], e]);
                }
                return;
            }
            if (canceled) {
                return;
            }
            setState([false, forwards, undefined]);
        })();
        return () => {
            canceled = true;
        };
    }, [client, setState]);

    return state;
}

export function useK8sPortForwardsListener(
    options: K8sPortForwardsOptions,
    deps: any[] = []
) {
    const { kubeContext, pauseOnHibernate = true, ...watcherOptions } = options;

    const eventsWhilePausedRef = useRef<Array<{ event: string; value: any }>>(
        []
    );
    const getHibernate = useHibernateGetter();
    const getIsPaused = useCallback(() => {
        return pauseOnHibernate && getHibernate();
    }, [pauseOnHibernate]);

    const watcher: K8sPortForwardWatcher = useMemo(
        () => ({
            ...emptyWatcher,
            ...watcherOptions,
            onChange(forwards) {
                if (getIsPaused()) {
                    // Coalesce the onChange events.
                    eventsWhilePausedRef.current =
                        eventsWhilePausedRef.current.filter(
                            (e) => e.event !== "onChange"
                        );
                    eventsWhilePausedRef.current.push({
                        event: "onChange",
                        value: [forwards],
                    });
                } else {
                    watcherOptions?.onChange?.(forwards);
                }
            },
            onError(err, portForwardId) {
                if (getIsPaused()) {
                    eventsWhilePausedRef.current.push({
                        event: "onError",
                        value: [err, portForwardId],
                    });
                } else {
                    watcherOptions?.onError?.(err, portForwardId);
                }
            },
            onStart(entry) {
                if (getIsPaused()) {
                    eventsWhilePausedRef.current.push({
                        event: "onStart",
                        value: [entry],
                    });
                } else {
                    watcherOptions?.onStart?.(entry);
                }
            },
            onStop(entry) {
                if (getIsPaused()) {
                    eventsWhilePausedRef.current.push({
                        event: "onStop",
                        value: [entry],
                    });
                } else {
                    watcherOptions?.onStop?.(entry);
                }
            },
            onStats(stats) {
                // Pass onStats events only if not paused; no use updating during pause.
                if (!getIsPaused()) {
                    watcherOptions?.onStats?.(stats);
                }
            },
        }),
        [getIsPaused, eventsWhilePausedRef, ...deps]
    );

    useEffect(() => {
        // If the deps change, remove our queued up events.
        eventsWhilePausedRef.current = [];
    }, [eventsWhilePausedRef, ...deps]);

    useHibernateListener(
        (isHibernating) => {
            // If we unpaused, process the changes.
            if (!isHibernating) {
                for (const e of eventsWhilePausedRef.current) {
                    (watcher as any)[e.event](...e.value);
                }
                eventsWhilePausedRef.current = [];
            }
        },
        [eventsWhilePausedRef, watcher]
    );

    const client = useK8sClient(kubeContext);

    useEffect(() => {
        const watch = client.watchPortForwards(watcher);
        return () => {
            watch.stop();
        };
    }, [client, watcher]);
}
