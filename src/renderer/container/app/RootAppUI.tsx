import React, { useEffect } from "react";
import { NamespaceList } from "../NamespaceList";
import { useK8sContext } from "../../context/k8s-context";

import { useBreakpointValue } from "@chakra-ui/react";
import { K8sContextSelector } from "../K8sContextSelector";

export const RootAppUI: React.FunctionComponent = () => {
    const kubeContext = useK8sContext();
    useEffect(() => {
        document.title = kubeContext || "Charm";
    }, [kubeContext]);

    const breakpoint = useBreakpointValue({
        base: "base",
        sm: "sm",
        md: "md",
        lg: "lg",
        xl: "xl",
        "2xl": "2xl",
    });

    return (
        <div>
            <K8sContextSelector />
            <NamespaceList />
        </div>
    );
};
