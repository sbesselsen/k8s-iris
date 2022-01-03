import React, { ChangeEvent, useCallback } from "react";
import { useK8sContext, useK8sContextStore } from "../context/k8s-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";

export const ContextSelector: React.FC = () => {
    const kubeContext = useK8sContext();
    const kubeContextStore = useK8sContextStore();

    const ipc = useIpc();

    const [loading, allContexts] = useAsync(() => ipc.k8s.listContexts(), []);

    const onChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement>) => {
            kubeContextStore.set(e.target.value);
        },
        [kubeContextStore]
    );

    return (
        <select onChange={onChange}>
            {loading && <option value={kubeContext}>{kubeContext}</option>}
            {!loading &&
                allContexts.map((context) => (
                    <option
                        key={context.name}
                        value={context.name}
                        selected={context.name === kubeContext}
                    >
                        {context.name}
                    </option>
                ))}
        </select>
    );
};
