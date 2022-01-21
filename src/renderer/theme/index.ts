import { extendTheme } from "@chakra-ui/react";

const colors: Record<string, string> = {
    honeydew: "#e0f2e9ff",
    blueViolet: "#631a86ff",
    blueGray: "#809bceff",
    skobeloff: "#156064ff",
    persianPink: "#ff8cc6ff",
};

export const theme = extendTheme({
    colors,
    components: {
        Heading: {
            variants: {
                eyecatcher: {
                    bgGradient: `linear(to-r, ${colors.blueViolet}, ${colors.persianPink})`,
                    bgClip: "text",
                    fontWeight: "extrabold",
                    fontSize: "6xl",
                    lineHeight: "80%",
                },
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
