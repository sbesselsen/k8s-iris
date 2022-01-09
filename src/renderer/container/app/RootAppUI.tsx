import React, { useEffect } from "react";
import { useK8sContext } from "../../context/k8s-context";

import { Box, Breadcrumb, BreadcrumbItem, VStack } from "@chakra-ui/react";
import { K8sContextSelector } from "../K8sContextSelector";
import { K8sNamespaceSelector } from "../K8sNamespaceSelector";
import { NamespaceList } from "../NamespaceList";
import { useK8sStatus } from "../../hook/k8s-status";

export const RootAppUI: React.FunctionComponent = () => {
    const kubeContext = useK8sContext();
    useEffect(() => {
        document.title = kubeContext || "Charm";
    }, [kubeContext]);

    const { status, error } = useK8sStatus();

    return (
        <VStack spacing={4} alignItems="start">
            <Breadcrumb>
                <BreadcrumbItem>
                    <K8sContextSelector />
                </BreadcrumbItem>
                <BreadcrumbItem>
                    <K8sNamespaceSelector />
                </BreadcrumbItem>
            </Breadcrumb>
            <Box>
                {status}
                {error ? String(error) : ""}
            </Box>
            <Box>
                <NamespaceList />
            </Box>
        </VStack>
    );
};
