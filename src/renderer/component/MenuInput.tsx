import { Box, Input, useMenuItem } from "@chakra-ui/react";
import React, { useCallback } from "react";

const navigationKeys = ["ArrowUp", "ArrowDown", "Escape"];

// See: https://github.com/chakra-ui/chakra-ui/issues/3697#issuecomment-811118964
export const MenuInput: typeof Input &
    React.FC<{ onPressEnter?: () => void }> = (props) => {
    const { role, ...rest } = useMenuItem(props);
    const { onPressEnter } = props;

    const onKeyDown = useCallback(
        (e) => {
            if (!navigationKeys.includes(e.key)) {
                e.stopPropagation();
            }
            if (e.key === "Enter") {
                onPressEnter?.();
            }
        },
        [onPressEnter]
    );

    return (
        <Box px="3" role={role}>
            <Input {...rest} onKeyDown={onKeyDown} />
        </Box>
    );
};
