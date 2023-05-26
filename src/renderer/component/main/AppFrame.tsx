import { Box, HStack, useColorModeValue, VStack } from "@chakra-ui/react";
import React, { MutableRefObject, ReactNode, useRef } from "react";
import { useWindowFocus, useWindowFocusValue } from "../../hook/window-focus";

export type AppFrameProps = {
    sidebar: ReactNode;
    content: ReactNode;
    toolbar: ReactNode;
};

export const AppFrame: React.FC<AppFrameProps> = (props) => {
    const { sidebar, content, toolbar } = props;

    const sidebarBoxRef = useRef<HTMLDivElement>();
    const sidebarContentRef = useRef<HTMLDivElement>();

    const contentBackground = useColorModeValue("white", "gray.900");
    const headerHeight = "48px";
    const sidebarBorderColor = useColorModeValue("gray.200", "gray.950");

    const sidebarOpacity = useWindowFocusValue(1.0, 0.7);

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
                flexBasis="250px"
                overflow="hidden"
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
                    opacity={sidebarOpacity}
                    spacing={0}
                    ps="85px"
                    pe={3}
                    justifyContent="end"
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
