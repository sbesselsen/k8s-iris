import React from "react";
import { ContextSelector } from "./container/ContextSelector";
import { NamespaceList } from "./container/NamespaceList";
import { useK8sContext } from "./context/k8s-context";

export const App: React.FunctionComponent = () => {
    const kubeContext = useK8sContext();

    return (
        <div>
            <h1>{kubeContext}</h1>
            <ContextSelector />
            <NamespaceList />
        </div>
    );
};
