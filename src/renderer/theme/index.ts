import { extendTheme, ThemeConfig } from "@chakra-ui/react";
import { Button } from "./component/button";
import { Checkbox } from "./component/checkbox";
import { Heading } from "./component/heading";
import { Menu } from "./component/menu";
import { Popover } from "./component/popover";
import { Tabs } from "./component/tabs";

const config: ThemeConfig = {
    useSystemColorMode: true,
};

function grayTint(n: number): string {
    const value = Math.round(255 * (1 - n / 1000));
    return `rgba(${value}, ${value}, ${value}, 1)`;
}

export const theme = extendTheme({
    config,
    colors: {
        gray: {
            50: grayTint(50),
            100: grayTint(100),
            200: grayTint(200),
            300: grayTint(300),
            400: grayTint(400),
            500: grayTint(500),
            600: grayTint(600),
            700: grayTint(700),
            800: grayTint(780),
            900: grayTint(860),
            950: grayTint(880),
        },
    },
    components: {
        Button,
        Checkbox,
        Code: {
            variants: {
                large: (options: any) => {
                    return {
                        fontFamily: "JetBrainsMono",
                        bg:
                            options.colorMode === "dark"
                                ? "gray.700"
                                : "gray.100",
                        borderRadius: "md",
                        p: 4,
                    };
                },
            },
        },
        Heading,
        Menu,
        Popover,
        Tabs,
    },
});
