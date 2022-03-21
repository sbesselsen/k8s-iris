import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
    useSystemColorMode: true,
};

export const theme = extendTheme({
    config,
    components: {
        Code: {
            variants: {
                large: (options: any) => {
                    return {
                        fontFamily:
                            '"Jetbrains Mono",SFMono-Regular,ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
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
    },
});
