import {
    Box,
    Button,
    Code,
    Container,
    Heading,
    HStack,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react";
import React, { Fragment, useCallback } from "react";
import { useK8sContext } from "../../context/k8s-context";
import { useWithDelay } from "../../hook/async";
import { useIpcCall } from "../../hook/ipc";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { useK8sStatus } from "../../hook/k8s-status";

const onClose = () => {};

export const ClusterError: React.FC<{ error: Error }> = (props) => {
    const { error } = props;

    const [isLoadingContexts, contextsInfo] = useK8sContextsInfo();
    const shouldShowSpinner = useWithDelay(isLoadingContexts, 1000);
    const kubeContext = useK8sContext();

    const loginForContext = useIpcCall((ipc) => ipc.cloud.loginForContext);

    const currentContext = contextsInfo?.find(
        (ctx) => ctx.name === kubeContext
    );
    const supportsAppLogin =
        currentContext?.cloudInfo?.supportsAppLogin ?? false;

    const onClickLoginButton = useCallback(() => {
        if (currentContext) {
            loginForContext(currentContext);
        }
    }, [currentContext, loginForContext]);

    return (
        <Container>
            <VStack spacing={6} mt={12} alignItems="start">
                <Heading variant="eyecatcher">
                    Error connecting to cluster
                </Heading>
                <Text>{error.message}</Text>
                <Text>
                    We will automatically keep trying to restore the connection.
                </Text>
                {shouldShowSpinner && (
                    <Box>
                        <Spinner />
                    </Box>
                )}
                <HStack>
                    {supportsAppLogin && (
                        <Button
                            onClick={onClickLoginButton}
                            size="lg"
                            colorScheme="green"
                        >
                            Log in
                        </Button>
                    )}
                </HStack>
            </VStack>
        </Container>
    );
};
