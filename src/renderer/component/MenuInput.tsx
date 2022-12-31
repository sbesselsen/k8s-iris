import { Box, Input, InputProps, useMenuItem } from "@chakra-ui/react";
import React, { useCallback } from "react";

const navigationKeys = ["ArrowUp", "ArrowDown", "Escape"];

// See: https://github.com/chakra-ui/chakra-ui/issues/3697#issuecomment-811118964
export const MenuInput: React.FC<InputProps & { onPressEnter?: () => void }> = (
    props
) => {
    const { role, ...rest } = useMenuItem(props as any);
    delete (rest as any).onPressEnter;
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
