import { HStack, useColorModeValue } from "@chakra-ui/react";
import React from "react";

export const Toolbar: React.FC<{}> = (props) => {
    const { children } = props;

    const bgColor = useColorModeValue("gray.100", "gray.700");
    const borderColor = useColorModeValue(bgColor, "gray.500");

    return (
        <HStack
            spacing={1}
            borderRadius="md"
            boxShadow="md"
            border="1px solid"
            borderColor={borderColor}
            bg={bgColor}
            p={2}
        >
            {children}
        </HStack>
    );
};
