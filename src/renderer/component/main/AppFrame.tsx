import { Box, HStack, useColorModeValue, VStack } from "@chakra-ui/react";
import React, { MutableRefObject, ReactNode, useRef } from "react";
import { useWindowFocus, useWindowFocusValue } from "../../hook/window-focus";

export type AppFrameProps = {
    search: ReactNode;
    sidebar: ReactNode;
    content: ReactNode;
    title: ReactNode;
    toolbar: ReactNode;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const { search, sidebar, content, toolbar, title } = props;

    const sidebarBoxRef = useRef<HTMLDivElement>();
    const sidebarContentRef = useRef<HTMLDivElement>();

    const contentBackground = useColorModeValue("white", "gray.900");
    const headerHeight = "48px";
    const sidebarBorderColor = useColorModeValue("gray.200", "gray.950");

    const sidebarOwnBackground = useColorModeValue("gray.100", "gray.800");
    const isFocused = useWindowFocus();
    const sidebarBackground = isFocused ? "transparent" : sidebarOwnBackground;

    const sidebarOpacity = useWindowFocusValue(1.0, 0.7);
    const headerBackground = contentBackground;
    const headerOpacity = useWindowFocusValue(1.0, 0.7);

    const sidebarWidth = "250px";

    // TODO: make button offset work in Windows as well, on the other side

    return (
        <HStack
            spacing={0}
            w="100vw"
            h="100vh"
            alignItems="stretch"
            position="relative"
        >
            <VStack
                spacing={0}
                flexGrow={0}
                flexShrink={0}
                flexBasis={sidebarWidth}
                overflow="hidden"
                bg={sidebarBackground}
                ref={sidebarBoxRef as MutableRefObject<HTMLDivElement>}
                position="relative"
                borderRight="1px solid"
                borderRightColor={sidebarBorderColor}
                alignItems="stretch"
            >
                <HStack
                    flex="0 0 0"
                    flexBasis={headerHeight}
                    sx={{ WebkitAppRegion: "drag" }}
                    opacity={headerOpacity}
                    spacing={0}
                    ps="85px"
                >
                    {toolbar}
                </HStack>
                <Box
                    flex="1 1 0"
                    ref={sidebarContentRef as MutableRefObject<HTMLDivElement>}
                    overflow="hidden"
                    opacity={sidebarOpacity}
                    pt="1px"
                >
                    {sidebar}
                </Box>
            </VStack>
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
                        flexGrow={1}
                        flexShrink={1}
                        flexBasis="0"
                        overflow="hidden"
                        opacity={headerOpacity}
                    >
                        {title}
                    </Box>
                    <Box
                        flexGrow={0}
                        flexShrink={0}
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
                    <Box flex="1 0 0" overflow="hidden">
                        {content}
                    </Box>
                </VStack>
            </VStack>
        </HStack>
    );
};
