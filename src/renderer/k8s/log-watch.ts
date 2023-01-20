import { useCallback, useEffect, useRef } from "react";
import { K8sLogSpec, K8sLogWatchOptions } from "../../common/k8s/client";
import { useHibernateGetter, useHibernateListener } from "../context/hibernate";
import { useK8sClient } from "./client";

export type K8sLogWatchListenerHookOptions = Omit<
    K8sLogWatchOptions,
    "onLogLine"
> & {
    kubeContext?: string;
    pauseOnHibernate?: boolean;
    onLogLine?: (line: string) => void;
    onLogLines?: (lines: string[]) => void;
    updateCoalesceInterval?: number;
};

export function useK8sLogWatchListener(
    spec: K8sLogSpec,
    options: K8sLogWatchListenerHookOptions,
    deps: any[]
): void {
    const {
        kubeContext,
        pauseOnHibernate = true,
        updateCoalesceInterval = 0,
        onLogLine,
        onLogLines,
        ...otherOptions
    } = options;

    const client = useK8sClient(kubeContext);

    const getHibernate = useHibernateGetter();
    const getIsPaused = useCallback(() => {
        return pauseOnHibernate && getHibernate();
    }, [pauseOnHibernate]);

    const coalescedLogLinesRef = useRef<string[]>([]);
    const coalescedTimeoutRef = useRef<any>();
    const pausedLogLinesRef = useRef<string[]>([]);

    useEffect(() => {
        // If our dependencies change, clear the logs.
        coalescedLogLinesRef.current = [];
        pausedLogLinesRef.current = [];
    }, [client, ...deps]);

    const logLines = useCallback(
        (lines: string[]) => {
            if (onLogLines) {
                onLogLines(lines);
            } else if (onLogLine) {
                lines.forEach(onLogLine);
            }
        },
        [...deps]
    );

    const pauseableLogLines = useCallback(
        (lines: string[]) => {
            if (getIsPaused()) {
                pausedLogLinesRef.current.push(...lines);
            } else {
                logLines(lines);
                pausedLogLinesRef.current = [];
            }
        },
        [getIsPaused, logLines, pausedLogLinesRef]
    );

    useHibernateListener(
        (isHibernating) => {
            if (!isHibernating && pausedLogLinesRef.current.length > 0) {
                // Get rid of the backlog we incurred while paused.
                logLines(pausedLogLinesRef.current);
                pausedLogLinesRef.current = [];
            }
        },
        [logLines, pausedLogLinesRef]
    );

    const coalescedLogLines = useCallback(
        (lines: string[]) => {
            if (updateCoalesceInterval <= 0) {
                pauseableLogLines(lines);
            } else {
                coalescedLogLinesRef.current.push(...lines);
                if (!coalescedTimeoutRef.current) {
                    // Set a new coalesced timeout.
                    coalescedTimeoutRef.current = setTimeout(() => {
                        pauseableLogLines(coalescedLogLinesRef.current);
                        coalescedLogLinesRef.current = [];
                        coalescedTimeoutRef.current = null;
                    }, updateCoalesceInterval);
                }
            }
        },
        [
            coalescedLogLinesRef,
            coalescedTimeoutRef,
            pauseableLogLines,
            updateCoalesceInterval,
        ]
    );

    useEffect(() => {
        const logWatch = client.logWatch(spec, {
            ...otherOptions,
            onLogLine: (line: string) => {
                coalescedLogLines([line]);
            },
        });

        return () => {
            logWatch.stop();
        };
    }, [client, coalescedLogLines, ...deps]);
}
