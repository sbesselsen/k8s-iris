import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
    useSystemColorMode: true,
};

export const theme = extendTheme({
    config,
    components: {
        Code: {
            variants: {
                large: {
                    fontFamily:
                        '"Jetbrains Mono",SFMono-Regular,ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
                    bg: "gray.100",
                    borderRadius: "md",
                    p: 4,
                },
            },
        },
        Heading: {
            variants: {
                menuGroup: {
                    color: "gray.500",
                    fontWeight: "semibold",
                    letterSpacing: "wide",
                    fontSize: "xs",
                    textTransform: "uppercase",
                },
            },
        },
    },
});

export const menuGroupStylesHack = {
    ".chakra-menu__group__title": {
        color: "gray.500",
        fontWeight: "semibold",
        letterSpacing: "wide",
        fontSize: "xs",
        textTransform: "uppercase",
    },
};
