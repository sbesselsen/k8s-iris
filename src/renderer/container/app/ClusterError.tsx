import {
    Button,
    Code,
    Heading,
    HStack,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { useColorTheme } from "../../context/color-theme";
import { useK8sContext } from "../../context/k8s-context";
import { useIpcCall } from "../../hook/ipc";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";

export const ClusterError: React.FC<{ error: Error }> = (props) => {
    const { error } = props;

    const [isLoadingContexts, contextsInfo] = useK8sContextsInfo();
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
            const resetTimeout = setTimeout(() => {
                setLoggingIn(false);
            }, 5000);
            loginForContext(currentContext).finally(() => {
                clearTimeout(resetTimeout);
                setLoggingIn(false);
            });
        }
    }, [currentContext, loginForContext, setLoggingIn]);

    const { colorScheme } = useColorTheme();

    if (isLoadingContexts) {
        return null;
    }

    return (
        <VStack
            spacing={6}
            mt={6}
            alignItems="start"
            ps={4}
            pe={12}
            maxWidth="800px"
        >
            <Heading textColor={colorScheme + ".500"}>
                Error connecting to cluster
            </Heading>
            <Code variant="large" fontSize="sm" userSelect="text">
                {error.message}
            </Code>
            <HStack>
                <Spinner size="sm" />
                <Text>Trying to restore the connection...</Text>
            </HStack>
            <HStack>
                {supportsAppLogin && (
                    <Button
                        onClick={onClickLoginButton}
                        colorScheme={colorScheme}
                        isDisabled={isLoggingIn}
                    >
                        Log in
                    </Button>
                )}
            </HStack>
        </VStack>
    );
};
