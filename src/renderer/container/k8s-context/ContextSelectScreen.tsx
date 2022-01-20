import { Box, CloseButton, Container, Heading, VStack } from "@chakra-ui/react";
import { ChakraStylesConfig } from "chakra-react-select";
import { useCallback, useMemo } from "react";
import { ContextSelect } from "./ContextSelect";
import { useK8sContext } from "../../context/k8s-context";
import { useIpc } from "../../hook/ipc";
import { useAppRouteActions } from "../../context/route";
import { useKeyListener } from "../../hook/keyboard";

export const ContextSelectScreen = () => {
    const kubeContext = useK8sContext();
    const { selectContext, toggleContextSelector } = useAppRouteActions();

    const ipc = useIpc();

    const onSelectContext = useCallback(
        (context: string, requestNewWindow: boolean) => {
            if (requestNewWindow) {
                ipc.app.createWindow({
                    context,
                });
            } else {
                selectContext(context);
                toggleContextSelector(false);
            }
        },
        [selectContext, toggleContextSelector]
    );

    const onClose = useCallback(() => {
        toggleContextSelector(false);
    }, [toggleContextSelector]);

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

    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (eventType === "keyup" && key === "Escape") {
                    // Escape was pressed.
                    onClose();
                }
            },
            [onClose]
        )
    );

    return (
        <Container>
            <Box position="absolute" right={6} top={4}>
                <CloseButton size="lg" onClick={onClose} />
            </Box>
            <VStack spacing={6} alignItems="start">
                <Heading mt={12} variant="eyecatcher">
                    Select context
                </Heading>
                <Box width="100%">
                    <ContextSelect
                        chakraStyles={chakraStyles}
                        selectedContext={kubeContext}
                        onSelectContext={onSelectContext}
                    />
                </Box>
            </VStack>
        </Container>
    );
};
