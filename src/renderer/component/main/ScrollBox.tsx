import {
    Box,
    BoxProps,
    forwardRef,
    HStack,
    useColorModeValue,
} from "@chakra-ui/react";
import React, {
    MutableRefObject,
    PropsWithChildren,
    ReactNode,
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useWindowResizeListener } from "../../hook/window-resize";

export type ScrollBoxProps = BoxProps & {
    attachedToolbar?: ReactNode;
};

const defaultAttachedToolbarSpace = 100;

export const ScrollBox = forwardRef<ScrollBoxProps, "div">((props, ref) => {
    const { attachedToolbar, ...boxProps } = props;

    const scrollBoxRef = useRef<HTMLDivElement | null>(null);
    useImperativeHandle(ref, () => scrollBoxRef.current);

    const topShadowRef = useRef<HTMLDivElement | null>(null);

    const attachedToolbarRef = useRef<HTMLDivElement>();

    const [attachedToolbarSpace, setAttachedToolbarSpace] = useState(
        defaultAttachedToolbarSpace
    );
    const updateAttachedToolbarSpace = useCallback(() => {
        setAttachedToolbarSpace(
            (space) =>
                attachedToolbarRef.current?.offsetHeight ??
                defaultAttachedToolbarSpace
        );
    }, [attachedToolbarRef, setAttachedToolbarSpace]);

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
        updateAttachedToolbarSpace();
        updateScrollShadows();
    }, [updateAttachedToolbarSpace, updateScrollShadows]);

    const onScroll = useCallback(() => {
        updateScrollShadows();
    }, [updateScrollShadows]);

    useWindowResizeListener(() => {
        updateAttachedToolbarSpace();
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
                {...(attachedToolbar
                    ? { pb: `${attachedToolbarSpace + 10}px` }
                    : {})}
            />
            {attachedToolbar ? (
                <HStack
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    pb={3}
                    px={6}
                    justifyContent="center"
                    pointerEvents="none"
                    ref={attachedToolbarRef as MutableRefObject<HTMLDivElement>}
                    zIndex={2}
                    sx={{ "> *": { pointerEvents: "auto" } }}
                >
                    {attachedToolbar}
                </HStack>
            ) : null}
        </Box>
    );
});

export const ScrollBoxHorizontalScroll: React.FC<PropsWithChildren<{}>> = (
    props
) => {
    const { children } = props;

    return (
        <Box overflowX="auto" px={4} mx={-4}>
            {children}
        </Box>
    );
};
