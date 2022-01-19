import React, { useEffect } from "react";
import { useK8sContext } from "../../context/k8s-context";

import {
    Box,
    Breadcrumb,
    BreadcrumbItem,
    Flex,
    HStack,
    useBreakpoint,
    useBreakpointValue,
    VStack,
} from "@chakra-ui/react";
import { K8sContextSelector } from "../K8sContextSelector";
import { K8sNamespaceSelector } from "../K8sNamespaceSelector";
import { NamespaceList } from "../NamespaceList";
import { useK8sStatus } from "../../hook/k8s-status";
import {
    Sticky,
    StickyContainer,
    stickToTop,
    stickToTopAndScrollDown,
} from "react-unstuck";

export const RootAppUI: React.FunctionComponent = () => {
    const kubeContext = useK8sContext();
    useEffect(() => {
        document.title = kubeContext || "Charm";
    }, [kubeContext]);

    const { status, error } = useK8sStatus();

    const headerStickyBehavior =
        useBreakpointValue({
            base: stickToTopAndScrollDown,
            sm: stickToTop,
        }) ?? stickToTopAndScrollDown;

    return (
        <StickyContainer>
            <Sticky behavior={headerStickyBehavior}>
                <Box bgColor="orange.200">
                    <Breadcrumb>
                        <BreadcrumbItem>
                            <K8sContextSelector />
                        </BreadcrumbItem>
                        <BreadcrumbItem>
                            <K8sNamespaceSelector />
                        </BreadcrumbItem>
                    </Breadcrumb>
                </Box>
            </Sticky>
            <Box>
                {status}
                {error ? String(error) : ""}
            </Box>
            <Box>
                <NamespaceList />
                <NamespaceList />
                <NamespaceList />
                <NamespaceList />
                <NamespaceList />
                <NamespaceList />
            </Box>
        </StickyContainer>
    );

    // return (
    //     <VStack spacing={4} alignItems="start">
    //         <Box>
    //             {status}
    //             {error ? String(error) : ""}
    //         </Box>
    //         <Box>
    //             <NamespaceList />
    //         </Box>
    //     </VStack>
    // );
};
