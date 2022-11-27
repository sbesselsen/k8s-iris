import { mode } from "@chakra-ui/theme-tools";

const baseStyle = (props) => {
    const { colorScheme } = props;

    console.log("Got basestyle");

    return {
        control: {
            _checked: {
                bg: mode(`${colorScheme}.500`, `${colorScheme}.400`)(props),
                borderColor: mode(
                    `${colorScheme}.500`,
                    `${colorScheme}.400`
                )(props),
                color: mode("white", "gray.900")(props),
            },

            _focusVisible: {
                boxShadow: "outline",
            },
        },
    };
};

export const Checkbox = {
    baseStyle,
    defaultProps: {
        colorScheme: "primary",
    },
};
