import {
    Box,
    BoxProps,
    forwardRef,
    HStack,
    useColorModeValue,
} from "@chakra-ui/react";
import React, {
    ReactNode,
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useWindowResizeListener } from "../../hook/window-resize";

export type ScrollBoxProps = BoxProps & {
    bottomToolbar?: ReactNode;
};

export const ScrollBox = forwardRef<ScrollBoxProps, "div">((props, ref) => {
    const { bottomToolbar, ...boxProps } = props;

    const scrollBoxRef = useRef<HTMLDivElement | null>(null);
    useImperativeHandle(ref, () => scrollBoxRef.current);

    const topShadowRef = useRef<HTMLDivElement | null>(null);

    const bottomToolbarRef = useRef<HTMLDivElement>();

    const [bottomToolbarSpace, setBottomToolbarSpace] = useState(100);
    const updateBottomToolbarSpace = useCallback(() => {
        setBottomToolbarSpace((space) =>
            Math.max(space, bottomToolbarRef.current?.offsetHeight ?? 0)
        );
    }, [bottomToolbarRef, setBottomToolbarSpace]);

    const updateScrollShadows = useCallback(() => {
        const elem = scrollBoxRef.current;
        if (!elem) {
            return;
        }
        if (topShadowRef.current) {
            const scrolledDown = elem.scrollTop > 0;
            topShadowRef.current.style.opacity = scrolledDown ? "1" : "0";
        }
    }, [scrollBoxRef, topShadowRef]);

    useLayoutEffect(() => {
        updateBottomToolbarSpace();
        updateScrollShadows();
    }, [updateBottomToolbarSpace, updateScrollShadows]);

    const onScroll = useCallback(() => {
        updateScrollShadows();
    }, [updateScrollShadows]);

    useWindowResizeListener(() => {
        updateBottomToolbarSpace();
        updateScrollShadows();
    }, [updateScrollShadows]);

    const shadowGradient = useColorModeValue(
        "linear(to-b, blackAlpha.200 0%, transparent 100%)",
        "linear(to-b, blackAlpha.600 0%, transparent 100%)"
    );

    return (
        <Box flex="1 0 0" position="relative" overflow="hidden" display="flex">
            <Box
                pointerEvents="none"
                top={0}
                left={0}
                right={0}
                bgGradient={shadowGradient}
                h="6px"
                position="absolute"
                transition="200ms opacity ease-in-out"
                zIndex={1}
                opacity={0}
                ref={topShadowRef}
            ></Box>
            <Box
                flex="1 0 0"
                overflow="hidden scroll"
                onScroll={onScroll}
                sx={{ scrollbarGutter: "stable" }}
                ref={scrollBoxRef}
                px={4}
                py={4}
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
                    pb={3}
                    justifyContent="center"
                    pointerEvents="none"
                    ref={bottomToolbarRef}
                    sx={{ "> *": { pointerEvents: "auto" } }}
                >
                    {bottomToolbar}
                </HStack>
            ) : null}
        </Box>
    );
});
