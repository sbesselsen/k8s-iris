import { ButtonGroup, HStack, useColorModeValue } from "@chakra-ui/react";
import React, { PropsWithChildren } from "react";

export const Toolbar: React.FC<PropsWithChildren> = (props) => {
    const { children } = props;

    const bgColor = useColorModeValue("gray.50", "gray.800");
    const borderColor = useColorModeValue(bgColor, "gray.700");

    return (
        <HStack
            borderRadius="lg"
            boxShadow="md"
            border="1px solid"
            borderColor={borderColor}
            bg={bgColor}
            p={1}
        >
            <ButtonGroup variant="toolbar" size="sm" spacing={0.5}>
                {children}
            </ButtonGroup>
        </HStack>
    );
};
