import {
    Box,
    Heading,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
} from "@chakra-ui/react";
import { ChakraStylesConfig } from "chakra-react-select";
import React, { useCallback, useMemo } from "react";
import { ContextSelect } from "./ContextSelect";
import { useK8sContext } from "../../context/k8s-context";
import { useIpc } from "../../hook/ipc";
import { useAppRouteActions } from "../../context/route";
import { useKeyListener } from "../../hook/keyboard";

export type ContextSelectDialogProps = {
    isOpen?: boolean;
};

export const ContextSelectScreen: React.FC<ContextSelectDialogProps> = (
    props
) => {
    const { isOpen = false } = props;

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

    const menuHeight = "calc(100vh - 270px)";
    const chakraStyles: ChakraStylesConfig = useMemo(
        () => ({
            menu: (provided) => ({
                ...provided,
                maxHeight: menuHeight,
            }),
            menuList: (provided) => ({
                ...provided,
                border: 0,
                borderRadius: 0,
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
        <Modal isOpen={isOpen} onClose={onClose} closeOnEsc={true}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>
                    <Heading variant="eyecatcher" fontSize="2xl">
                        Select context
                    </Heading>
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <Box width="100%" height="calc(100vh - 200px)">
                        <ContextSelect
                            chakraStyles={chakraStyles}
                            selectedContext={kubeContext}
                            onSelectContext={onSelectContext}
                        />
                    </Box>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};
