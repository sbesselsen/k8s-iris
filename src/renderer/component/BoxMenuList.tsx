import {
    Box,
    BoxProps,
    Button,
    useMenuContext,
    useMenuList,
} from "@chakra-ui/react";
import React, { FocusEvent, KeyboardEvent, useCallback, useRef } from "react";

export const BoxMenuList: React.FC<BoxProps> = (props) => {
    const { children, ...boxProps } = props;
    const { focusedIndex, setFocusedIndex } = useMenuContext();
    const { onKeyDown, style: _, ...menuListProps } = useMenuList();

    const boxOnKeyDown = boxProps.onKeyDown;

    const wrappedKeyDown = useCallback(
        (e: KeyboardEvent<Element>) => {
            boxOnKeyDown?.(e as KeyboardEvent<HTMLDivElement>);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                onKeyDown(e);
            }
        },
        [boxOnKeyDown, onKeyDown]
    );

    return (
        <Box
            {...menuListProps}
            {...boxProps}
            onKeyDown={wrappedKeyDown}
            outline="none"
        >
            {children}
        </Box>
    );
};
