import React, { useEffect } from "react";
import { useK8sContext } from "../../context/k8s-context";

import { VStack } from "@chakra-ui/react";
import { K8sContextSelector } from "../K8sContextSelector";
import { K8sNamespaceSelector } from "../K8sNamespaceSelector";

export const RootAppUI: React.FunctionComponent = () => {
    const kubeContext = useK8sContext();
    useEffect(() => {
        document.title = kubeContext || "Charm";
    }, [kubeContext]);

    return (
        <VStack spacing={4}>
            <K8sContextSelector />
            <K8sNamespaceSelector />
        </VStack>
    );
};
