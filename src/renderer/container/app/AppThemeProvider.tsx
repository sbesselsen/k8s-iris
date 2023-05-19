import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import Color from "color";

import { theme } from "../../theme";
import { useColorTheme } from "../../context/color-theme";
import { useIpcCall } from "../../hook/ipc";

const whiteColor = Color("#ffffff");
const blackColor = Color("#000000");

export const AppThemeProvider: React.FC<PropsWithChildren> = (props) => {
    const { children } = props;

    const getAccentColor = useIpcCall((ipc) => ipc.appearance.getAccentColor);
    const watchAccentColor = useIpcCall(
        (ipc) => ipc.appearance.watchAccentColor
    );

    const [accentColor, setAccentColor] = useState<null | string>(null);

    useEffect(() => {
        let stopped = false;
        let prevValue: string | null = null;
        getAccentColor().then((color) => {
            if (!stopped && prevValue !== color) {
                prevValue = color;
                setAccentColor(color);
            }
        });
        const { stop } = watchAccentColor(undefined, (_error, color) => {
            if (typeof color === "string" && color !== prevValue) {
                prevValue = color;
                setAccentColor(color);
            }
        });
        return () => {
            stopped = true;
            stop();
        };
    }, [getAccentColor, watchAccentColor, setAccentColor]);

    const colorScheme = useColorTheme((t) => t.colorScheme);
    const currentTheme = useMemo(() => {
        const currentTheme = { ...theme };
        if (accentColor) {
            currentTheme.colors.systemAccent = {
                50: Color(accentColor).mix(whiteColor, 0.95).hex(),
                100: Color(accentColor).mix(whiteColor, 0.8).hex(),
                200: Color(accentColor).mix(whiteColor, 0.6).hex(),
                300: Color(accentColor).mix(whiteColor, 0.4).hex(),
                400: Color(accentColor).mix(whiteColor, 0.2).hex(),
                500: accentColor,
                600: Color(accentColor).mix(blackColor, 0.2).hex(),
                700: Color(accentColor).mix(blackColor, 0.4).hex(),
                800: Color(accentColor).mix(blackColor, 0.5).hex(),
                900: Color(accentColor).mix(blackColor, 0.6).hex(),
            };
        }
        currentTheme.colors.contextClue = theme.colors[colorScheme];
        currentTheme.colors.primary =
            currentTheme.colors.systemAccent ?? currentTheme.colors.gray;
        return currentTheme;
    }, [accentColor, colorScheme, theme]);

    if (accentColor === null) {
        return null;
    }

    return <ChakraProvider theme={currentTheme}>{children}</ChakraProvider>;
};
