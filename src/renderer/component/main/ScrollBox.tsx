import { Box, BoxProps } from "@chakra-ui/react";
import React from "react";

export const ScrollBox: React.FC<BoxProps> = (props) => {
    return (
        <Box
            flex="1 0 0"
            overflow="hidden scroll"
            sx={{ scrollbarGutter: "stable" }}
            {...props}
        />
    );
};
