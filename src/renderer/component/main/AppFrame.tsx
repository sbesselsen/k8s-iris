import { Box, HStack, useColorModeValue, VStack } from "@chakra-ui/react";
import React, {
    PointerEventHandler,
    ReactElement,
    useCallback,
    useRef,
    useState,
} from "react";
import { useColorTheme } from "../../context/color-theme";
import { useWindowFocusValue } from "../../hook/window-focus";

export type AppFrameProps = {
    search: ReactElement;
    sidebar: ReactElement;
    content: ReactElement;
    title: ReactElement;
    colorScheme?: string;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const {
        search,
        sidebar,
        content,
        title,
        colorScheme: propsColorScheme,
    } = props;

    const { colorScheme: defaultColorScheme } = useColorTheme();

    const colorScheme = propsColorScheme ?? defaultColorScheme ?? "gray";

    const separatorWidth = "8px";
    const [sidebarWidth, setSidebarWidth] = useState("250px");
    const sidebarMinWidth = 200;
    const contentMinWidth = 400;

    const vSeparatorBoxRef = useRef<HTMLDivElement>();
    const sidebarBoxRef = useRef<HTMLDivElement>();

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
            }
        },
        [separatorDragState, sidebarBoxRef, vSeparatorBoxRef]
    );

    // When dragging ends, rerender with the new sidebar width.
    const onPointerUp: PointerEventHandler<HTMLDivElement> = useCallback(() => {
        if (separatorDragState.isDragging) {
            separatorDragState.isDragging = false;
            setSidebarWidth(separatorDragState.currentSidebarWidth + "px");
        }
    }, [separatorDragState, setSidebarWidth]);

    const contentBackground = useColorModeValue("white", "black");
    const headerBackground = useColorModeValue(
        colorScheme + useWindowFocusValue(".300", ".400"),
        colorScheme + useWindowFocusValue(".700", ".800")
    );
    const sidebarBackground = useColorModeValue(
        colorScheme + ".100",
        colorScheme + ".900"
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
                    flexGrow="0"
                    flexShrink="0"
                    flexBasis="250px"
                    h="100%"
                ></Box>
                <Box
                    flexGrow="1"
                    flexShrink="0"
                    flexBasis="300px"
                    overflow="hidden"
                    h="100%"
                >
                    {title}
                </Box>
                <Box
                    flexGrow="0"
                    flexShrink="0"
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
                    flexGrow="0"
                    flexShrink="0"
                    flexBasis={sidebarWidth}
                    bg={sidebarBackground}
                    overflow="hidden"
                    ref={sidebarBoxRef}
                >
                    {sidebar}
                </Box>
                <Box
                    flexGrow="0"
                    flexShrink="0"
                    flexBasis={separatorWidth}
                    bg={contentBackground}
                    cursor="col-resize"
                    onPointerDown={onVSeparatorPointerDown}
                    ref={vSeparatorBoxRef}
                ></Box>
                <Box flex="1 0 0" bg={contentBackground} overflow="hidden">
                    {content}
                </Box>
            </HStack>
        </VStack>
    );
};
