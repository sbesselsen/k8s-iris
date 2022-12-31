import { useEffect, useMemo, useRef, useState } from "react";
import {
    K8sPortForwardEntry,
    K8sPortForwardStats,
    K8sPortForwardWatcher,
} from "../../common/k8s/client";
import { useHibernate } from "../context/hibernate";
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
    const isPaused = useHibernate() && pauseOnHibernate;

    const watcher: K8sPortForwardWatcher = useMemo(
        () =>
            isPaused
                ? {
                      ...emptyWatcher,
                      onChange(forwards) {
                          // Coalesce the onChange events.
                          eventsWhilePausedRef.current =
                              eventsWhilePausedRef.current.filter(
                                  (e) => e.event !== "onChange"
                              );
                          eventsWhilePausedRef.current.push({
                              event: "onChange",
                              value: [forwards],
                          });
                      },
                      onError(err, portForwardId) {
                          eventsWhilePausedRef.current.push({
                              event: "onError",
                              value: [err, portForwardId],
                          });
                      },
                      onStart(entry) {
                          eventsWhilePausedRef.current.push({
                              event: "onStart",
                              value: [entry],
                          });
                      },
                      onStop(entry) {
                          eventsWhilePausedRef.current.push({
                              event: "onStop",
                              value: [entry],
                          });
                      },
                      // Drop onStats events.
                  }
                : {
                      ...emptyWatcher,
                      ...watcherOptions,
                  },
        [isPaused, eventsWhilePausedRef, ...deps]
    );

    useEffect(() => {
        // If the deps change, remove our queued up events.
        eventsWhilePausedRef.current = [];
    }, [eventsWhilePausedRef, ...deps]);

    useEffect(() => {
        // If we unpaused, process the changes.
        if (!isPaused) {
            for (const e of eventsWhilePausedRef.current) {
                (watcher as any)[e.event](...e.value);
            }
            eventsWhilePausedRef.current = [];
        }
    }, [eventsWhilePausedRef, isPaused, watcher]);

    const client = useK8sClient(kubeContext);

    useEffect(() => {
        const watch = client.watchPortForwards(watcher);
        return () => {
            watch.stop();
        };
    }, [client, watcher]);
}
