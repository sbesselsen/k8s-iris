import {
    Box,
    HStack,
    useColorModeValue,
    useToken,
    VStack,
} from "@chakra-ui/react";
import React, {
    createContext,
    PointerEventHandler,
    ReactElement,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useWindowFocusValue } from "../../hook/window-focus";
import { useWindowResizeListener } from "../../hook/window-resize";

const SidebarVisibleContext = createContext(true);

export type AppFrameProps = {
    search: ReactElement;
    sidebar: ReactElement;
    content: ReactElement;
    title: ReactElement;
    toolbar: ReactElement;
    isSidebarVisible?: boolean;
    onRequestSidebarVisibilityChange?: (visible: boolean) => void;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const {
        search,
        sidebar,
        content,
        toolbar,
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
    const headerHeight = "48px";
    const sidebarBorderColor = useColorModeValue(
        "gray.200",
        useWindowFocusValue("whiteAlpha.200", "blackAlpha.600")
    );

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
    const sidebarBackground = isSidebarFloating
        ? sidebarOwnBackground
        : "transparent";

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

    // TODO: make button offset work in Windows as well, on the other side

    return (
        <SidebarVisibleContext.Provider value={isSidebarVisible}>
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
                    overflow="hidden"
                    bg={sidebarBackground}
                    ref={sidebarBoxRef}
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
                    boxShadow={isSidebarFloating ? "lg" : "none"}
                    borderRight={isSidebarFloating ? "0" : "1px solid"}
                    borderRightColor={sidebarBorderColor}
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
                        ref={vSeparatorBoxRef}
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
                        w={
                            isSidebarFloating
                                ? floatingSidebarWidth
                                : sidebarWidth
                        }
                        ref={sidebarContentRef}
                        position="absolute"
                        top={isSidebarFloating ? 0 : headerHeight}
                        bottom={0}
                        right={0}
                        overflow="hidden"
                        opacity={sidebarOpacity}
                        pt="1px"
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
                            pl={
                                !isSidebarVisible || isSidebarFloating
                                    ? "80px"
                                    : 2
                            }
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
                                opacity={0.7}
                                bg={contentBackground}
                                zIndex={1}
                            ></Box>
                        )}
                        <Box flex="1 0 0" overflow="hidden">
                            {content}
                        </Box>
                    </VStack>
                </VStack>
            </HStack>
        </SidebarVisibleContext.Provider>
    );
};

export function useAppContentResizeListener(f: () => void, deps: any[]) {
    useWindowResizeListener(() => {
        f();
    }, deps);
    const isSidebarVisible = useContext(SidebarVisibleContext);
    useEffect(() => {
        f();
        setTimeout(() => {
            f();
        }, 200);
    }, [isSidebarVisible, ...deps]);
}
