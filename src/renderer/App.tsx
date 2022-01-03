import React from "react";
import { ClusterSelector } from "./container/ClusterSelector";
import { NamespaceList } from "./container/NamespaceList";
import { useKubeContext } from "./context/kube-context";

export const App: React.FunctionComponent = () => {
    const kubeContext = useKubeContext();

    return (
        <div>
            <h1>{kubeContext}</h1>
            <ClusterSelector />
            <NamespaceList />
        </div>
    );
};
