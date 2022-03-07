import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
    useSystemColorMode: true,
};

export const theme = extendTheme({
    config,
    components: {
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
