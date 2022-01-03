import React, { useEffect } from "react";
import { ContextSelector } from "../ContextSelector";
import { NamespaceList } from "../NamespaceList";
import { useK8sContext } from "../../context/k8s-context";

import { useBreakpointValue } from "@chakra-ui/react";

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
            <h1>{kubeContext}</h1>
            <h2>{breakpoint}</h2>
            <ContextSelector />
            <NamespaceList />
        </div>
    );
};
