import { mode } from "@chakra-ui/theme-tools";

const parts = ["content"];

type Dict = Record<string, any>;

function baseStyleContent(props: Dict) {
    const bg = mode("white", "gray.900")(props);
    const shadowColor = mode("gray.200", "whiteAlpha.300")(props);
    return {
        "--popover-bg": `colors.${bg}`,
        bg: "var(--popover-bg)",
        "--popper-arrow-bg": "var(--popover-bg)",
        "--popper-arrow-shadow-color": `colors.${shadowColor}`,
        boxShadow: "dark-lg",
        _focus: {
            outline: 0,
            boxShadow: "dark-lg",
        },
    };
}

const baseStyle = (props: Dict) => ({
    content: baseStyleContent(props),
});

export const Popover = {
    parts,
    baseStyle,
};
