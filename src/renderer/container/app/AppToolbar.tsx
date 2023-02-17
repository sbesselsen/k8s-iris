import React, { useCallback } from "react";
import { ButtonGroup, HStack, Icon, IconButton } from "@chakra-ui/react";

import { MdArrowBackIosNew, MdArrowForwardIos } from "react-icons/md";
import { FiLock, FiUnlock } from "react-icons/fi";
import {
    useAppRoute,
    useAppRouteHistory,
    useAppRouteSetter,
} from "../../context/route";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { HamburgerIcon } from "@chakra-ui/icons";
import {
    useContextLock,
    useContextLockSetter,
} from "../../context/context-lock";
import {
    ContextMenuButton,
    MenuItem,
} from "../../component/main/ContextMenuButton";
import { useOptionalK8sContext } from "../../context/k8s-context";

export const AppToolbar: React.FC = () => {
    const { canGoBack, canGoForward, goBack, goForward } = useAppRouteHistory();
    const isSidebarVisible = useAppRoute((route) => route.isSidebarVisible);
    const setAppRoute = useAppRouteSetter();

    const kubeContext = useOptionalK8sContext();

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
        <HStack py={2} spacing={0}>
            <ButtonGroup variant="toolbar" size="sm" isAttached>
                <IconButton
                    disabled={!canGoBack}
                    onClick={goBack}
                    icon={<Icon as={MdArrowBackIosNew} />}
                    aria-label="Back"
                    title="Back"
                    _focus={{}}
                    _focusVisible={{ boxShadow: "outline" }}
                />
                <IconButton
                    disabled={!canGoForward}
                    onClick={goForward}
                    icon={<Icon as={MdArrowForwardIos} />}
                    aria-label="Forward"
                    title="Forward"
                    _focus={{}}
                    _focusVisible={{ boxShadow: "outline" }}
                />
            </ButtonGroup>
            <ButtonGroup variant="toolbar" size="sm">
                <IconButton
                    onClick={toggleSidebarVisible}
                    icon={<HamburgerIcon />}
                    aria-label={isSidebarVisible ? "Hide menu" : "Show menu"}
                    title={isSidebarVisible ? "Hide menu" : "Show menu"}
                    _focus={{}}
                    _focusVisible={{ boxShadow: "outline" }}
                />
            </ButtonGroup>
            {kubeContext && <ContextLockButton />}
        </HStack>
    );
};

const ContextLockButton: React.FC = () => {
    const isLocked = useContextLock();
    const setLock = useContextLockSetter();
    const onLockAction = useCallback(
        ({ actionId }: { actionId: string }) => {
            setLock(actionId === "lock");
        },
        [setLock]
    );

    return (
        <ButtonGroup variant="toolbar" size="sm">
            <ContextMenuButton
                as={IconButton}
                px={1}
                icon={<Icon as={isLocked ? FiLock : FiUnlock} />}
                aria-label="Lock/unlock cluster"
                title="Lock/unlock cluster"
                onMenuAction={onLockAction}
                _focus={{ boxShadow: "none" }}
                _focusVisible={{ boxShadow: "outline" }}
            >
                <MenuItem
                    label="Locked"
                    type="radio"
                    actionId="lock"
                    checked={isLocked}
                />
                <MenuItem
                    label="Unlocked"
                    type="radio"
                    actionId="unlock"
                    checked={!isLocked}
                />
            </ContextMenuButton>
        </ButtonGroup>
    );
};
