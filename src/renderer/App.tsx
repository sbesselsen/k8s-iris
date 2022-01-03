import React from "react";

import { ChakraProvider } from "@chakra-ui/react";
import { RootAppUI } from "./container/app/RootAppUI";

export const App: React.FunctionComponent = () => {
    return (
        <ChakraProvider>
            <RootAppUI />
        </ChakraProvider>
    );
};
