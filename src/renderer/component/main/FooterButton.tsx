import { Button, ButtonProps, useColorModeValue } from "@chakra-ui/react";
import React from "react";

export const FooterButton: React.FC<ButtonProps> = (props) => {
    const colorScheme = useColorModeValue("gray", "gray");
    const borderColor = useColorModeValue("gray.100", "gray.950");

    return (
        <Button
            borderRadius={0}
            colorScheme={colorScheme}
            fontWeight="normal"
            variant="ghost"
            borderLeft="1px solid"
            borderLeftColor={borderColor}
            size="xs"
            maxWidth="150px"
            isTruncated
            {...props}
        />
    );
};
