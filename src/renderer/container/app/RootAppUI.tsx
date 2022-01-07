import React, { useEffect } from "react";
import { NamespaceList } from "../NamespaceList";
import { useK8sContext } from "../../context/k8s-context";

import { Box, Flex, useBreakpointValue, VStack } from "@chakra-ui/react";
import { K8sContextSelector } from "../K8sContextSelector";
import { K8sNamespaceSelector } from "../K8sNamespaceSelector";

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
        <VStack>
            <K8sContextSelector />
            <K8sNamespaceSelector />
        </VStack>
    );
};
