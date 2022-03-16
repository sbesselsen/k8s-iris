import React, { useMemo } from "react";
import { ChakraProvider } from "@chakra-ui/react";

import { theme } from "../../theme";
import { useColorTheme } from "../../context/color-theme";

export const AppThemeProvider: React.FC = (props) => {
    const { children } = props;

    const colorScheme = useColorTheme((t) => t.colorScheme);
    const currentTheme = useMemo(() => {
        const currentTheme = { ...theme };
        currentTheme.colors.primary = theme.colors[colorScheme];
        return currentTheme;
    }, [colorScheme, theme]);

    return <ChakraProvider theme={currentTheme}>{children}</ChakraProvider>;
};
