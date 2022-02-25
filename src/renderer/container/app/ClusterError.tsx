import {
    Box,
    Button,
    Container,
    Heading,
    HStack,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { useK8sContext } from "../../context/k8s-context";
import { useWithDelay } from "../../hook/async";
import { useIpcCall } from "../../hook/ipc";
import { useK8sContextColorScheme } from "../../hook/k8s-context-color-scheme";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";

export const ClusterError: React.FC<{ error: Error }> = (props) => {
    const { error } = props;

    const [isLoadingContexts, contextsInfo] = useK8sContextsInfo();
    const shouldShowSpinner = useWithDelay(isLoadingContexts, 1000);
    const kubeContext = useK8sContext();

    const [isLoggingIn, setLoggingIn] = useState(false);

    const loginForContext = useIpcCall((ipc) => ipc.cloud.loginForContext);

    const currentContext = contextsInfo?.find(
        (ctx) => ctx.name === kubeContext
    );
    const supportsAppLogin =
        currentContext?.cloudInfo?.supportsAppLogin ?? false;

    const onClickLoginButton = useCallback(() => {
        if (currentContext) {
            setLoggingIn(true);
            loginForContext(currentContext).finally(() => {
                setLoggingIn(false);
            });
        }
    }, [currentContext, loginForContext, setLoggingIn]);

    const colors = useK8sContextColorScheme();

    return (
        <VStack spacing={6} mt={12} alignItems="start">
            <Heading textColor={colors.text}>
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
                        bg={colors.fill}
                        textColor={colors.background}
                    >
                        <HStack spacing={2}>
                            {isLoggingIn && (
                                <Spinner color={colors.background} />
                            )}
                            <Text>Log in</Text>
                        </HStack>
                    </Button>
                )}
            </HStack>
        </VStack>
    );
};
