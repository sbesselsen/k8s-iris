import { Box, HStack, VStack } from "@chakra-ui/react";
import React, {
    PointerEventHandler,
    ReactElement,
    useCallback,
    useRef,
    useState,
} from "react";
import { useColorTheme } from "../context/color-theme";

export type AppFrameProps = {
    header: ReactElement;
    sidebar: ReactElement;
    content: ReactElement;
    title: ReactElement;
    colorScheme?: string;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const {
        header,
        sidebar,
        content,
        title,
        colorScheme: propsColorScheme,
    } = props;

    const { colorScheme: defaultColorScheme } = useColorTheme();

    const colorScheme = propsColorScheme ?? defaultColorScheme ?? "gray";

    const separatorWidth = "8px";
    const [sidebarWidth, setSidebarWidth] = useState("300px");
    const sidebarMinWidth = 200;
    const contentMinWidth = 400;

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
                bg={colorScheme + ".300"}
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
                    w="100%"
                    h="3px"
                    position="absolute"
                    bgGradient="linear(to-b, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.0))"
                    zIndex={1}
                ></Box>
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
    );
};
