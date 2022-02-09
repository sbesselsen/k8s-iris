import { useCallback, useRef, useState } from "react";
import { K8sObjectListWatcherMessage } from "../../common/k8s/client";
import { useK8sContext } from "../context/k8s-context";
import { useK8sListWatch } from "../k8s/list-watch";
import { create } from "../util/state";

type K8sStatusCheck = {
    stop: () => void;
    listeners: Array<(status: K8sStatus) => void>;
};
type K8sStatusChecks = Record<string, K8sStatusCheck>;

export const [useK8sStatusChecksStore, useK8sStatusChecks] =
    create<K8sStatusChecks>({});

export type K8sStatus = {
    status: "ok" | "unknown" | "error";
    error?: any;
};

const unknownStatus: K8sStatus = {
    status: "unknown",
};

const okStatus: K8sStatus = {
    status: "ok",
};

export const useK8sStatusListener = (listener: (status: K8sStatus) => void) => {
    const kubeContext = useK8sContext();
    const prevKubeContextRef = useRef<string>();
    const prevStatusRef = useRef<K8sStatus["status"] | undefined>();

    const notifyListener = useCallback(
        (status: K8sStatus) => {
            if (status.status !== prevStatusRef.current) {
                prevStatusRef.current = status.status;
                listener(status);
            }
        },
        [listener, prevStatusRef]
    );

    if (prevKubeContextRef.current !== kubeContext) {
        // When switching kubeContext, reset the status.
        prevKubeContextRef.current = kubeContext;
        notifyListener(unknownStatus);
    }

    const onUpdate = useCallback(
        (message: K8sObjectListWatcherMessage) => {
            notifyListener(okStatus);
        },
        [notifyListener]
    );
    const onWatchError = useCallback(
        (error: any) => {
            notifyListener({
                status: "error",
                error,
            });
        },
        [notifyListener]
    );

    const [_loading, _list, error] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        [onUpdate, onWatchError],
        {
            onUpdate,
            onWatchError,
        }
    );
    if (error) {
        notifyListener({
            status: "error",
            error,
        });
    }
};

export const useK8sStatusRef = (): { current: K8sStatus } => {
    const ref = useRef<K8sStatus>(unknownStatus);
    const listener = useCallback(
        (status: K8sStatus) => {
            ref.current = status;
        },
        [ref]
    );
    useK8sStatusListener(listener);
    return ref;
};

export const useK8sStatus = (): K8sStatus => {
    const [status, setStatus] = useState<K8sStatus>(unknownStatus);
    const listener = useCallback(
        (status: K8sStatus) => {
            setStatus(status);
        },
        [setStatus]
    );
    useK8sStatusListener(listener);
    return status;
};
