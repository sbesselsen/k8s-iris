import React, { ChangeEvent, useCallback } from "react";
import { useKubeContext, useKubeContextStore } from "../context/kube-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";

export const ClusterSelector: React.FC = () => {
    const kubeContext = useKubeContext();
    const kubeContextStore = useKubeContextStore();

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
