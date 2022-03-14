import React, { useCallback } from "react";
import { Box, ButtonGroup, Icon, IconButton } from "@chakra-ui/react";

import { MdArrowBackIosNew, MdArrowForwardIos } from "react-icons/md";
import { useAppRouteHistory } from "../../context/route-history";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";

export const AppToolbar: React.FC = () => {
    const { canGoBack, canGoForward, goBack, goForward } = useAppRouteHistory();

    const metaKeyRef = useModifierKeyRef("Meta");
    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (eventType === "keydown" && metaKeyRef.current) {
                    if (key === "ArrowLeft") {
                        console.log("back");
                    } else if (key === "ArrowRight") {
                        console.log("forward");
                    }
                }
            },
            [goBack, goForward, metaKeyRef]
        )
    );

    return (
        <Box py={2}>
            <ButtonGroup
                variant="ghost"
                colorScheme="primary"
                size="sm"
                _focus={{}}
                isAttached
            >
                <IconButton
                    disabled={!canGoBack}
                    onClick={goBack}
                    icon={<Icon as={MdArrowBackIosNew} />}
                    aria-label="Back"
                    tabIndex={-1}
                />
                <IconButton
                    disabled={!canGoForward}
                    onClick={goForward}
                    icon={<Icon as={MdArrowForwardIos} />}
                    aria-label="Forward"
                    tabIndex={-1}
                />
            </ButtonGroup>
        </Box>
    );
};
