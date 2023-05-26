import { Box, HStack, useColorModeValue, VStack } from "@chakra-ui/react";
import React, {
    MutableRefObject,
    PointerEventHandler,
    ReactNode,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useWindowFocus, useWindowFocusValue } from "../../hook/window-focus";
import { useWindowResizeListener } from "../../hook/window-resize";

export type AppFrameProps = {
    search: ReactNode;
    sidebar: ReactNode;
    content: ReactNode;
    title: ReactNode;
    toolbar: ReactNode;
    footer: ReactNode;
    isSidebarVisible?: boolean;
    onRequestSidebarVisibilityChange?: (visible: boolean) => void;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const {
        search,
        sidebar,
        content,
        toolbar,
        footer,
        title,
        isSidebarVisible = true,
        onRequestSidebarVisibilityChange,
    } = props;

    const [sidebarWidth, setSidebarWidth] = useState("250px");
    const floatingSidebarWidth = "300px";
    const sidebarMinWidth = 200;
    const contentMinWidth = 400;

    const vSeparatorBoxRef = useRef<HTMLDivElement>();
    const sidebarBoxRef = useRef<HTMLDivElement>();
    const sidebarContentRef = useRef<HTMLDivElement>();

    // Separator dragging logic.
    const [separatorDragState] = useState({
        isDragging: false,
        dragStartX: 0,
        dragStartSidebarWidth: 0,
        currentSidebarWidth: 0,
    });

    const shouldSidebarBeFloating = useCallback(() => {
        return window.innerWidth - parseInt(sidebarWidth, 10) <= 380;
    }, [sidebarWidth]);
    const [isSidebarFloating, setSidebarFloating] = useState(
        shouldSidebarBeFloating()
    );

    // When pointer is pressed on the separator, initiate dragging.
    const onVSeparatorPointerDown: PointerEventHandler<HTMLDivElement> =
        useCallback(
            (e) => {
                if (!sidebarBoxRef.current) {
                    return;
                }
                separatorDragState.isDragging = true;
                separatorDragState.dragStartX = e.clientX;
                separatorDragState.currentSidebarWidth =
                    separatorDragState.dragStartSidebarWidth =
                        sidebarBoxRef.current.clientWidth;
                sidebarBoxRef.current.style.transition = "none";
            },
            [separatorDragState, sidebarBoxRef, sidebarContentRef]
        );

    // When pointer is moved while dragging, dynamically recalculate the layout *without rerendering*.
    const onPointerMove: PointerEventHandler<HTMLDivElement> = useCallback(
        (e) => {
            if (
                !vSeparatorBoxRef.current ||
                !sidebarBoxRef.current ||
                !sidebarContentRef.current
            ) {
                return;
            }
            if (separatorDragState.isDragging) {
                separatorDragState.currentSidebarWidth = Math.max(
                    sidebarMinWidth,
                    Math.min(
                        document.documentElement.clientWidth -
                            contentMinWidth -
                            vSeparatorBoxRef.current.clientWidth,
                        Math.round(
                            separatorDragState.dragStartSidebarWidth +
                                e.clientX -
                                separatorDragState.dragStartX
                        )
                    )
                );
                sidebarBoxRef.current.style.flexBasis =
                    separatorDragState.currentSidebarWidth + "px";
                sidebarContentRef.current.style.width =
                    separatorDragState.currentSidebarWidth + "px";
            }
        },
        [separatorDragState, sidebarBoxRef, sidebarContentRef, vSeparatorBoxRef]
    );

    // When dragging ends, rerender with the new sidebar width.
    const onPointerUp: PointerEventHandler<HTMLDivElement> = useCallback(() => {
        if (separatorDragState.isDragging) {
            separatorDragState.isDragging = false;
            setSidebarWidth(separatorDragState.currentSidebarWidth + "px");
        }
    }, [separatorDragState, setSidebarWidth]);

    useLayoutEffect(() => {
        if (sidebarBoxRef.current) {
            sidebarBoxRef.current.style.flexBasis = "";
            sidebarBoxRef.current.style.transition = "";
        }
        if (sidebarContentRef.current) {
            sidebarContentRef.current.style.width = "";
        }
    }, [sidebarWidth, sidebarBoxRef, sidebarContentRef]);

    const contentBackground = useColorModeValue("white", "gray.900");
    const headerHeight = "48px";
    const sidebarBorderColor = useColorModeValue("gray.200", "gray.950");

    useWindowResizeListener(() => {
        const newSidebarFloating = shouldSidebarBeFloating();
        if (newSidebarFloating !== isSidebarFloating) {
            // Make the window floating.
            setSidebarFloating(newSidebarFloating);
            onRequestSidebarVisibilityChange?.(!newSidebarFloating);
        }
    }, [
        isSidebarFloating,
        onRequestSidebarVisibilityChange,
        setSidebarFloating,
        shouldSidebarBeFloating,
    ]);

    const sidebarOwnBackground = useColorModeValue("gray.100", "gray.800");
    const isFocused = useWindowFocus();
    const sidebarBackground =
        isSidebarFloating || isFocused ? "transparent" : sidebarOwnBackground;
    const sidebarFloatingBrightness = useColorModeValue("95%", "150%");

    const onClickContent = useCallback(() => {
        if (isSidebarFloating) {
            onRequestSidebarVisibilityChange?.(false);
        }
    }, [isSidebarFloating, onRequestSidebarVisibilityChange]);

    const sidebarOpacity = useWindowFocusValue(
        1.0,
        isSidebarFloating ? 1.0 : 0.7
    );
    const headerBackground = contentBackground;
    const headerOpacity = useWindowFocusValue(1.0, 0.7);

    const footerBorderColor = useColorModeValue("gray.100", "gray.950");

    // TODO: make button offset work in Windows as well, on the other side

    return (
        <HStack
            spacing={0}
            w="100vw"
            h="100vh"
            alignItems="stretch"
            position="relative"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            <Box
                flexGrow={0}
                flexShrink={0}
                flexBasis={isSidebarVisible ? sidebarWidth : 0}
                overflow={isSidebarFloating ? "visible" : "hidden"}
                bg={sidebarBackground}
                ref={sidebarBoxRef as MutableRefObject<HTMLDivElement>}
                position={isSidebarFloating ? "absolute" : "relative"}
                top={isSidebarFloating ? headerHeight : "initial"}
                bottom={isSidebarFloating ? 0 : "initial"}
                left={isSidebarFloating ? 0 : "initial"}
                w={
                    isSidebarFloating
                        ? isSidebarVisible
                            ? floatingSidebarWidth
                            : 0
                        : "initial"
                }
                zIndex={20}
                transitionDuration={isSidebarFloating ? "100ms" : "200ms"}
                transitionTimingFunction="ease-out"
                transitionProperty="flex-basis, width"
                borderRight={isSidebarFloating ? "0" : "1px solid"}
                borderRightColor={sidebarBorderColor}
                {...(isSidebarFloating
                    ? {
                          backdropFilter: "auto",
                          backdropBlur: "20px",
                          backdropSaturate: "150%",
                          backdropBrightness: sidebarFloatingBrightness,
                      }
                    : {})}
            >
                <Box
                    display={isSidebarFloating ? "none" : "block"}
                    position="absolute"
                    w={2}
                    h="100%"
                    cursor="col-resize"
                    onPointerDown={onVSeparatorPointerDown}
                    top="0"
                    right="0"
                    ref={vSeparatorBoxRef as MutableRefObject<HTMLDivElement>}
                    zIndex={1}
                ></Box>
                <Box
                    display={
                        isSidebarFloating && isSidebarVisible ? "block" : "none"
                    }
                    position="absolute"
                    w={2}
                    bgGradient="linear(to-r, blackAlpha.300, transparent)"
                    h="100%"
                    top="0"
                    right={-2}
                    pointerEvents="none"
                    zIndex={1}
                ></Box>
                {!isSidebarFloating && (
                    <Box
                        h={headerHeight}
                        w={sidebarWidth}
                        top={0}
                        left={0}
                        boxSizing="content-box"
                        sx={{ WebkitAppRegion: "drag" }}
                        opacity={headerOpacity}
                        position="absolute"
                    ></Box>
                )}
                <Box
                    w={isSidebarFloating ? floatingSidebarWidth : sidebarWidth}
                    ref={sidebarContentRef as MutableRefObject<HTMLDivElement>}
                    position="absolute"
                    top={isSidebarFloating ? 0 : headerHeight}
                    bottom={0}
                    right={0}
                    overflow="hidden"
                    opacity={sidebarOpacity}
                    pt={isSidebarFloating ? 2 : "1px"}
                >
                    {sidebar}
                </Box>
            </Box>
            <VStack
                flex="1 0 0"
                overflow="hidden"
                alignItems="stretch"
                spacing={0}
            >
                <HStack
                    flex="0 0 0"
                    flexBasis={headerHeight}
                    bg={headerBackground}
                    spacing={0}
                    justifyContent="space-between"
                    alignItems="stretch"
                    sx={{ WebkitAppRegion: "drag" }}
                >
                    <Box
                        flexGrow={0}
                        flexShrink={10}
                        flexBasis={0}
                        pr={2}
                        pl={!isSidebarVisible || isSidebarFloating ? "80px" : 2}
                        opacity={headerOpacity}
                    >
                        {toolbar}
                    </Box>
                    <Box
                        flexGrow={1}
                        flexShrink={11}
                        flexBasis="300px"
                        overflow="hidden"
                        opacity={headerOpacity}
                    >
                        {title}
                    </Box>
                    <Box
                        flexGrow={0}
                        flexShrink={10}
                        flexBasis="250px"
                        overflow="hidden"
                        textAlign="end"
                        opacity={headerOpacity}
                    >
                        {search}
                    </Box>
                </HStack>
                <VStack
                    spacing={0}
                    flex="1 0 0"
                    bg={contentBackground}
                    alignItems="stretch"
                >
                    {isSidebarVisible && isSidebarFloating && (
                        <Box
                            position="absolute"
                            w="100%"
                            h="100%"
                            onClick={onClickContent}
                            opacity={0.9}
                            bg={contentBackground}
                            zIndex={10}
                        ></Box>
                    )}
                    <Box flex="1 0 0" overflow="hidden">
                        {content}
                    </Box>
                    {footer && (
                        <HStack
                            flex="0 0 24px"
                            borderTop="1px solid"
                            borderTopColor={footerBorderColor}
                            justifyContent="end"
                            spacing={0}
                            pe={2}
                        >
                            {footer}
                        </HStack>
                    )}
                </VStack>
            </VStack>
        </HStack>
    );
};
