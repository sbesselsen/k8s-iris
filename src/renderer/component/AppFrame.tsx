import { Box, HStack, VStack } from "@chakra-ui/react";
import React, {
    Fragment,
    PointerEventHandler,
    ReactElement,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useKeyListener } from "../hook/keyboard";

export type AppFrameProps = {
    header: ReactElement;
    sidebar: ReactElement;
    content: ReactElement;
    title: ReactElement;
    backboard: ReactElement;
    colorScheme?: string;
    shouldShowBackboard?: boolean;
    onRequestHideBackboard?: () => void;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const {
        backboard,
        header,
        sidebar,
        content,
        title,
        colorScheme = "gray",
        shouldShowBackboard = false,
        onRequestHideBackboard,
    } = props;

    const separatorWidth = "8px";
    const [sidebarWidth, setSidebarWidth] = useState("200px");
    const sidebarMinWidth = 200;
    const contentMinWidth = 500;

    const titleBoxRef = useRef<HTMLDivElement>();
    const vSeparatorBoxRef = useRef<HTMLDivElement>();
    const sidebarBoxRef = useRef<HTMLDivElement>();

    // Separator dragging logic.
    const [separatorDragState] = useState({
        isDragging: false,
        dragStartX: 0,
        dragStartSidebarWidth: 0,
        currentSidebarWidth: 0,
    });

    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (
                    shouldShowBackboard &&
                    eventType === "keyup" &&
                    key === "Escape"
                ) {
                    onRequestHideBackboard?.();
                }
            },
            [onRequestHideBackboard, shouldShowBackboard]
        )
    );

    // When pointer is pressed on the frame while backboard is visible, request that we hide the backboard.
    const onPointerDown: PointerEventHandler<HTMLDivElement> = useCallback(
        (e) => {
            if (shouldShowBackboard) {
                onRequestHideBackboard?.();
            }
        },
        [onRequestHideBackboard, shouldShowBackboard]
    );

    // When pointer is pressed on the separator, initiate dragging.
    const onVSeparatorPointerDown: PointerEventHandler<HTMLDivElement> =
        useCallback(
            (e) => {
                separatorDragState.isDragging = true;
                separatorDragState.dragStartX = e.clientX;
                separatorDragState.currentSidebarWidth =
                    separatorDragState.dragStartSidebarWidth =
                        sidebarBoxRef.current.clientWidth;
            },
            [separatorDragState, sidebarBoxRef]
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
                titleBoxRef.current.style.flexBasis =
                    separatorDragState.currentSidebarWidth + "px";
            }
        },
        [separatorDragState, sidebarBoxRef, titleBoxRef, vSeparatorBoxRef]
    );

    // When dragging ends, rerender with the new sidebar width.
    const onPointerUp: PointerEventHandler<HTMLDivElement> = useCallback(() => {
        if (separatorDragState.isDragging) {
            separatorDragState.isDragging = false;
            setSidebarWidth(separatorDragState.currentSidebarWidth + "px");
        }
    }, [separatorDragState, setSidebarWidth]);

    return (
        <Fragment>
            <VStack
                position="fixed"
                top={shouldShowBackboard ? "calc(70% - 20px)" : "0"}
                left={shouldShowBackboard ? "calc(70% - 20px)" : "0"}
                w="100vw"
                h="100vh"
                alignItems="stretch"
                spacing={0}
                transform={shouldShowBackboard ? "scale(0.3)" : "none"}
                transformOrigin="top left"
                transitionProperty="top, left, transform"
                transitionDuration="500ms"
                transitionTimingFunction="ease-in-out"
                borderRadius={shouldShowBackboard ? "20px" : "0"}
                boxShadow={
                    shouldShowBackboard
                        ? "rgba(0, 0, 0, 0.4) 0px 5px 20px, rgba(0, 0, 0, 0.3) 0px 20px 80px"
                        : "none"
                }
                overflow="hidden"
                onPointerMove={onPointerMove}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
            >
                <HStack
                    flex="0 0 0"
                    bg={colorScheme + ".200"}
                    spacing={0}
                    alignItems="stretch"
                >
                    <Box
                        flexGrow="0"
                        flexShrink="0"
                        flexBasis={sidebarWidth}
                        overflow="hidden"
                        ref={titleBoxRef}
                    >
                        {title}
                    </Box>
                    <Box
                        flexGrow="0"
                        flexShrink="0"
                        flexBasis={separatorWidth}
                    ></Box>
                    <Box flex="1 0 0" overflow="hidden">
                        {header}
                    </Box>
                </HStack>
                <HStack spacing={0} flex="1 0 0" alignItems="stretch" h={0}>
                    <Box
                        flexGrow="0"
                        flexShrink="0"
                        flexBasis={sidebarWidth}
                        bg={colorScheme + ".100"}
                        overflow="hidden scroll"
                        sx={{ scrollbarGutter: "stable" }}
                        ref={sidebarBoxRef}
                    >
                        {sidebar}
                    </Box>
                    <Box
                        flexGrow="0"
                        flexShrink="0"
                        flexBasis={separatorWidth}
                        bg="white"
                        cursor="col-resize"
                        onPointerDown={onVSeparatorPointerDown}
                        ref={vSeparatorBoxRef}
                    ></Box>
                    <Box
                        flex="1 0 0"
                        bg="white"
                        overflow="scroll"
                        sx={{ scrollbarGutter: "stable" }}
                    >
                        {content}
                    </Box>
                </HStack>
            </VStack>
            <Box w="100vw" h="100vh" overflow="scroll">
                {backboard}
            </Box>
        </Fragment>
    );
};
