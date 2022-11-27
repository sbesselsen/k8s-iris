import React, { useCallback } from "react";
import {
    useContextLock,
    useContextLockSetter,
} from "../../context/context-lock";
import { HiLockClosed } from "react-icons/hi";
import { Button, Icon } from "@chakra-ui/react";

export const ContextUnlockButton: React.FC = () => {
    const isLocked = useContextLock();

    const setLock = useContextLockSetter();
    const onClickUnlock = useCallback(() => {
        setLock(false);
    }, [setLock]);

    if (!isLocked) {
        return null;
    }

    return (
        <Button
            leftIcon={<Icon as={HiLockClosed} />}
            onClick={onClickUnlock}
            size="sm"
            boxShadow="0 1px 2px rgba(0, 0, 0, 0.1)"
            aria-label="Allow changes"
        >
            Allow changes
        </Button>
    );
};
