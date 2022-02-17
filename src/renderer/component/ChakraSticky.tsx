import { chakra, ChakraComponent } from "@chakra-ui/react";
import React from "react";
import { IStickyProps, Sticky } from "react-unstuck";

export const ChakraSticky = chakra(Sticky);

export const AppSticky: ChakraComponent<React.FC<IStickyProps>, {}> = (
    props
) => {
    return <ChakraSticky bg="white" {...props} />;
};
