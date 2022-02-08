import React from "react";

import { ChakraProvider } from "@chakra-ui/react";
import { RootAppUI } from "./container/app/RootAppUI";
import { theme } from "./theme";
import { StickyContainer } from "react-unstuck";

export const App: React.FunctionComponent = () => {
    return (
        <ChakraProvider theme={theme}>
            <StickyContainer>
                <RootAppUI />
            </StickyContainer>
        </ChakraProvider>
    );
};
