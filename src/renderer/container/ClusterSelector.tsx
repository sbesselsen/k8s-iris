import React from "react";
import { useKubeContext } from "../context/kube-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";

export const ClusterSelector: React.FC = () => {
    const kubeContext = useKubeContext();
    const ipc = useIpc();

    const [loading, allContexts] = useAsync(() => ipc.k8s.listContexts(), []);

    return (
        <select>
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
