import { mode } from "@chakra-ui/theme-tools";

export const Heading = {
    baseStyle: (props) => {
        return {
            textColor: mode("gray.800", "white")(props),
        };
    },
    defaultProps: {
        size: "sm",
    },
};
