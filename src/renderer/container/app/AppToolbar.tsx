import React, { useCallback } from "react";
import { ButtonGroup, HStack, Icon, IconButton } from "@chakra-ui/react";

import { MdArrowBackIosNew, MdArrowForwardIos } from "react-icons/md";
import {
    useAppRoute,
    useAppRouteHistory,
    useAppRouteSetter,
} from "../../context/route";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { HamburgerIcon } from "@chakra-ui/icons";

export const AppToolbar: React.FC = () => {
    const { canGoBack, canGoForward, goBack, goForward } = useAppRouteHistory();
    const isSidebarVisible = useAppRoute((route) => route.isSidebarVisible);
    const setAppRoute = useAppRouteSetter();

    const toggleSidebarVisible = useCallback(() => {
        setAppRoute(
            (route) => ({
                ...route,
                isSidebarVisible: !route.isSidebarVisible,
            }),
            true
        );
    }, [setAppRoute]);

    const metaKeyRef = useModifierKeyRef("Meta");
    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (eventType === "keydown" && metaKeyRef.current) {
                    if (key === "ArrowLeft") {
                        goBack();
                    } else if (key === "ArrowRight") {
                        goForward();
                    }
                }
            },
            [goBack, goForward, metaKeyRef]
        )
    );

    return (
        <HStack py={2}>
            <ButtonGroup
                variant="ghost"
                colorScheme="primary"
                size="sm"
                isAttached
            >
                <IconButton
                    disabled={!canGoBack}
                    onClick={goBack}
                    icon={<Icon as={MdArrowBackIosNew} />}
                    aria-label="Back"
                    _focus={{}}
                    tabIndex={-1}
                />
                <IconButton
                    disabled={!canGoForward}
                    onClick={goForward}
                    icon={<Icon as={MdArrowForwardIos} />}
                    aria-label="Forward"
                    _focus={{}}
                    tabIndex={-1}
                />
            </ButtonGroup>
            <ButtonGroup variant="ghost" colorScheme="primary" size="sm">
                <IconButton
                    onClick={toggleSidebarVisible}
                    icon={<HamburgerIcon />}
                    aria-label={isSidebarVisible ? "Hide menu" : "Show menu"}
                    _focus={{}}
                    tabIndex={-1}
                />
            </ButtonGroup>
        </HStack>
    );
};
