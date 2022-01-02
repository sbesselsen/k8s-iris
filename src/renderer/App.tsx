import React from "react";
import { ClusterSelector } from "./container/ClusterSelector";
import { useKubeContext } from "./context/kube-context";
import { useAsync } from "./hook/async";
import { useIpc } from "./hook/ipc";

export const App: React.FunctionComponent = () => {
    const kubeContext = useKubeContext();

    const ipc = useIpc();

    const [loading, namespaces, error] = useAsync(async () => {
        if (!kubeContext) {
            return [];
        }
        const namespaceObjects = await ipc.k8s.list({
            context: kubeContext,
            spec: {
                apiVersion: "v1",
                kind: "Namespace",
            },
        });
        return namespaceObjects.items.map((item) => item.metadata.name);
    }, [ipc, kubeContext]);

    return (
        <div>
            <h1>{kubeContext}</h1>
            <ClusterSelector />
            {loading && <p>Loading</p>}
            {error && <p>Error: {error}</p>}
            {!loading && !error && (
                <ul>
                    {namespaces.map((ns) => (
                        <li key={ns}>{ns}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};
