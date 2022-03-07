import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
    config: {
        useSystemColorMode: true,
    },
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
