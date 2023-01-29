import { mode } from "@chakra-ui/theme-tools";

const parts = ["list"];

function baseStyleList(props: Record<string, any>) {
    return {
        bg: mode(`#fff`, `gray.900`)(props),
    };
}

const baseStyle = (props: Record<string, any>) => ({
    list: baseStyleList(props),
});

export const Menu = {
    parts,
    baseStyle,
};
