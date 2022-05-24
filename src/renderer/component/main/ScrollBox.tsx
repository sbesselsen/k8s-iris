import { Box, BoxProps, forwardRef, HStack } from "@chakra-ui/react";
import React, {
    ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

export type ScrollBoxProps = BoxProps & {
    bottomToolbar?: ReactNode;
};

export const ScrollBox = forwardRef<ScrollBoxProps, "div">((props, ref) => {
    const { bottomToolbar, ...boxProps } = props;

    const bottomToolbarRef = useRef<HTMLDivElement>();

    const [bottomToolbarSpace, setBottomToolbarSpace] = useState(100);
    const updateBottomToolbarSpace = useCallback(() => {
        setBottomToolbarSpace((space) =>
            Math.max(space, bottomToolbarRef.current?.offsetHeight)
        );
    }, [bottomToolbarRef, setBottomToolbarSpace]);

    useEffect(() => {
        updateBottomToolbarSpace();
        window.addEventListener("resize", updateBottomToolbarSpace);
        return () => {
            window.removeEventListener("resize", updateBottomToolbarSpace);
        };
    }, [updateBottomToolbarSpace]);

    return (
        <Box flex="1 0 0" position="relative" overflow="hidden" display="flex">
            <Box
                flex="1 0 0"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
                ref={ref}
                {...boxProps}
                {...(bottomToolbar
                    ? { pb: `${bottomToolbarSpace + 10}px` }
                    : {})}
            />
            {bottomToolbar ? (
                <HStack
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    px={6}
                    pb={4}
                    justifyContent="center"
                    ref={bottomToolbarRef}
                >
                    {bottomToolbar}
                </HStack>
            ) : null}
        </Box>
    );
});
