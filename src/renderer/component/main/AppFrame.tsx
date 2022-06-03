import {
    Box,
    HStack,
    useColorModeValue,
    useToken,
    VStack,
} from "@chakra-ui/react";
import React, {
    PointerEventHandler,
    ReactElement,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useWindowFocusValue } from "../../hook/window-focus";

export type AppFrameProps = {
    search: ReactElement;
    sidebar: ReactElement;
    content: ReactElement;
    title: ReactElement;
    toolbar: ReactElement;
    isSidebarVisible?: boolean;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const {
        search,
        sidebar,
        content,
        toolbar,
        title,
        isSidebarVisible = true,
    } = props;

    const [sidebarWidth, setSidebarWidth] = useState("250px");
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

    // When pointer is pressed on the separator, initiate dragging.
    const onVSeparatorPointerDown: PointerEventHandler<HTMLDivElement> =
        useCallback(
            (e) => {
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
    const headerBackground = useColorModeValue(
        useWindowFocusValue("primary.300", "primary.400"),
        useWindowFocusValue("primary.700", "primary.800")
    );
    const primaryColorIsGray =
        useToken("colors", "primary.500") === useToken("colors", "gray.500");
    const sidebarBackground = useColorModeValue(
        "primary.100",
        primaryColorIsGray ? "primary.800" : "primary.900"
    );

    // TODO: make button offset work in Windows as well, on the other side

    return (
        <VStack
            w="100vw"
            h="100vh"
            bg="green"
            alignItems="stretch"
            spacing={0}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            <HStack
                flex="0 0 30px"
                bg={headerBackground}
                spacing={0}
                justifyContent="space-between"
                alignItems="stretch"
                sx={{ WebkitAppRegion: "drag" }}
            >
                <Box
                    flexGrow={0}
                    flexShrink={10}
                    flexBasis="250px"
                    pl="85px"
                    h="100%"
                >
                    {toolbar}
                </Box>
                <Box
                    flexGrow={1}
                    flexShrink={11}
                    flexBasis="300px"
                    overflow="hidden"
                    h="100%"
                >
                    {title}
                </Box>
                <Box
                    flexGrow={0}
                    flexShrink={10}
                    flexBasis="250px"
                    overflow="hidden"
                    textAlign="end"
                    h="100%"
                >
                    {search}
                </Box>
            </HStack>
            <HStack spacing={0} flex="1 0 0" alignItems="stretch" h={0}>
                <Box
                    w="100%"
                    h="3px"
                    position="absolute"
                    bgGradient="linear(to-b, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0))"
                    zIndex={1}
                ></Box>
                <Box
                    flexGrow={0}
                    flexShrink={0}
                    flexBasis={isSidebarVisible ? sidebarWidth : 0}
                    bg={sidebarBackground}
                    overflow="hidden"
                    ref={sidebarBoxRef}
                    position="relative"
                    transitionDelay="100ms"
                    transitionDuration="200ms"
                    transitionTimingFunction="ease-out"
                    transitionProperty="flex-basis"
                >
                    <Box
                        position="absolute"
                        w={2}
                        h="100%"
                        cursor="col-resize"
                        onPointerDown={onVSeparatorPointerDown}
                        top="0"
                        right="0"
                        ref={vSeparatorBoxRef}
                        zIndex={1}
                    ></Box>
                    <Box
                        w={sidebarWidth}
                        ref={sidebarContentRef}
                        h="100%"
                        position="absolute"
                        right={0}
                        overflow="hidden"
                    >
                        {sidebar}
                    </Box>
                </Box>
                <Box flex="1 0 0" bg={contentBackground} overflow="hidden">
                    {content}
                </Box>
            </HStack>
        </VStack>
    );
};
