import { HStack, useColorModeValue } from "@chakra-ui/react";
import React from "react";

export const Toolbar: React.FC<{}> = (props) => {
    const { children } = props;

    const bgColor = useColorModeValue("gray.100", "gray.800");
    const borderColor = useColorModeValue(bgColor, "gray.700");

    return (
        <HStack
            spacing={1}
            borderRadius="lg"
            boxShadow="md"
            border="1px solid"
            borderColor={borderColor}
            bg={bgColor}
            p={1}
        >
            {children}
        </HStack>
    );
};
