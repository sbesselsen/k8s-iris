import { Box, BoxProps, forwardRef } from "@chakra-ui/react";
import React from "react";

export const ScrollBox = forwardRef<BoxProps, "div">((props, ref) => {
    return (
        <Box
            flex="1 0 0"
            overflow="hidden scroll"
            sx={{ scrollbarGutter: "stable" }}
            ref={ref}
            {...props}
        />
    );
});
