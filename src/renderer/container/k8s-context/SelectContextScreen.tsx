import { Box, Container, Heading, VStack } from "@chakra-ui/react";
import { ChakraStylesConfig } from "chakra-react-select";
import { useCallback, useMemo } from "react";
import { SelectContextContainer } from "./SelectContextContainer";
import { useK8sContext, useK8sContextStore } from "../../context/k8s-context";
import { useIpc } from "../../hook/ipc";
import { usePageTitle } from "../../hook/page-title";

export const SelectContextScreen = () => {
    usePageTitle();

    const kubeContext = useK8sContext();
    const kubeContextStore = useK8sContextStore();

    const ipc = useIpc();

    const onSelectContext = useCallback(
        (context: string, requestNewWindow: boolean) => {
            if (requestNewWindow) {
                ipc.app.createWindow({
                    context,
                });
            } else {
                kubeContextStore.set(context);
            }
        },
        [kubeContextStore]
    );

    const menuHeight = "calc(100vh - 250px)";
    const chakraStyles: ChakraStylesConfig = useMemo(
        () => ({
            menu: (provided) => ({
                ...provided,
                maxHeight: menuHeight,
            }),
            menuList: (provided) => ({
                ...provided,
                maxHeight: menuHeight,
            }),
        }),
        [menuHeight]
    );

    return (
        <Container>
            <VStack spacing={6} alignItems="start">
                <Heading mt={12} variant="eyecatcher">
                    Select context
                </Heading>
                <Box width="100%">
                    <SelectContextContainer
                        chakraStyles={chakraStyles}
                        selectedContext={kubeContext}
                        onSelectContext={onSelectContext}
                    />
                </Box>
            </VStack>
        </Container>
    );
};
