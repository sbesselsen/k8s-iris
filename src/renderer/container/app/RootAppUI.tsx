import React, { useEffect } from "react";
import { NamespaceList } from "../NamespaceList";
import { useK8sContext } from "../../context/k8s-context";

import { Box, Flex, useBreakpointValue } from "@chakra-ui/react";
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
        <Flex direction="row" wrap="nowrap" height="100vh">
            <Box
                flexGrow={0}
                flexShrink={0}
                flexBasis="150px"
                bgColor="green.300"
            >
                <K8sContextSelector height="100%" />
            </Box>
            <Box flexGrow={0} flexShrink={0} flexBasis="150px" bgColor="white">
                <K8sNamespaceSelector />
            </Box>
            <Box flexBasis="100%" bgColor="blue.300">
                test
            </Box>
        </Flex>
    );
};
