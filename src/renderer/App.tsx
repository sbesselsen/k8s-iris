import React, { useEffect, useRef, useState } from "react";
import { K8sObjectListWatch } from "../common/k8s/client";
import { ClusterSelector } from "./container/ClusterSelector";
import { useKubeContext } from "./context/kube-context";
import { useAsync } from "./hook/async";
import { useK8sClient } from "./k8s/client";

export const App: React.FunctionComponent = () => {
    const kubeContext = useKubeContext();
    const client = useK8sClient();

    const [namespaces, setNamespaces] = useState<string[]>([]);

    const prevListWatch = useRef<K8sObjectListWatch | undefined>();

    const [loading, listWatch, error] = useAsync(async () => {
        return await client.listWatch(
            {
                apiVersion: "v1",
                kind: "Namespace",
            },
            (list, update) => {
                console.log("did receive update");
                setNamespaces(list.items.map((item) => item.metadata.name));
            }
        );
    }, [client, setNamespaces]);

    console.log(loading, listWatch);
    if (error) {
        console.error(error);
    }

    if (prevListWatch.current && prevListWatch.current !== listWatch) {
        prevListWatch.current.stop();
    }
    prevListWatch.current = listWatch;

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
