import { Box, BoxProps, useMenuContext, useMenuList } from "@chakra-ui/react";
import React, { KeyboardEvent, useCallback } from "react";

export const BoxMenuList: React.FC<BoxProps> = (props) => {
    const boxProps = props;
    const { focusedIndex, setFocusedIndex } = useMenuContext();
    const { onKeyDown, style: _, ...menuListProps } = useMenuList();

    const boxOnKeyDown = boxProps.onKeyDown;

    const wrappedKeyDown = useCallback(
        (e: KeyboardEvent<Element>) => {
            boxOnKeyDown?.(e as KeyboardEvent<HTMLDivElement>);
            if (e.key !== "Tab") {
                onKeyDown(e);
            }
        },
        [boxOnKeyDown, onKeyDown]
    );

    const onFocus = useCallback(() => {
        if (focusedIndex === -1) {
            setFocusedIndex(0);
        }
    }, [focusedIndex, setFocusedIndex]);

    return (
        <Box
            {...menuListProps}
            {...boxProps}
            onKeyDown={wrappedKeyDown}
            onFocus={onFocus}
            outline="none"
        />
    );
};
