import { mode } from "@chakra-ui/theme-tools";

const content = (props) => {
    return {
        tablist: {
            bgGradient: "linear(to-t, gray.200 0%, gray.100 4px)",
        },
        tab: {
            whiteSpace: "nowrap",
            marginLeft: "-1px",
            py: 3,
            color: mode("gray.600", "gray.200")(props),
            borderLeft: "1px solid",
            borderRight: "1px solid",
            borderColor: "gray.200",
            borderTopColor: "transparent",
            fontWeight: "semibold",
            fontSize: props.size,
            textTransform: "uppercase",
            px: 6,
            bgGradient: "linear(to-t, gray.200 0%, gray.100 2px, gray.50 4px)",
            _selected: {
                color: mode("black", "white")(props),
                bg: "white",
                _hover: {
                    bg: "white",
                },
            },
            _hover: {
                bg: "blackAlpha.200",
            },
            _active: {},
            _disabled: {},
            _focus: {
                boxShadow: "none",
            },
            _focusVisible: {
                boxShadow: "outline",
            },
        },
    };
};

export const Tabs = {
    baseStyle: () => {},
    defaultProps: {
        colorScheme: "primary",
        size: "sm",
    },
    variants: {
        content,
    },
};
