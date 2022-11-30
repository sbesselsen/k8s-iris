const solid = (props) => {
    const { colorMode, colorScheme } = props;
    return {
        transitionProperty: "none",
        bg: colorMode === "light" ? `${colorScheme}.500` : `${colorScheme}.500`,
        color: "white",
        _hover: {
            bg:
                colorMode === "light"
                    ? `${colorScheme}.600`
                    : `${colorScheme}.300`,
        },
        _active: {
            bg:
                colorMode === "light"
                    ? `${colorScheme}.700`
                    : `${colorScheme}.200`,
        },
    };
};

const ghost = (props) => {
    const { colorMode, colorScheme } = props;
    return {
        bg: "transparent",
        transitionProperty: "none",
        color:
            colorMode === "light" ? `${colorScheme}.600` : `${colorScheme}.400`,
        _hover: {
            bg: colorMode === "light" ? "blackAlpha.100" : "whiteAlpha.200",
        },
        _active: {
            bg: `${colorScheme}.500`,
            color: "white",
        },
    };
};

const sidebar = (props) => {
    const { colorMode, colorScheme } = props;
    return {
        bg: colorMode === "light" ? `blackAlpha.200` : `whiteAlpha.200`,
        color: colorMode === "light" ? `gray.700` : `white`,
        fontWeight: "normal",
        transitionProperty: "none",
        justifyContent: "start",
        _hover: {
            bg: colorMode === "light" ? "blackAlpha.50" : "whiteAlpha.200",
        },
        _active: {
            bg: `${colorScheme}.500`,
            color: "white",
            "& .chakra-button__icon": {
                color: "white",
            },
        },
        "& > div": {
            flexGrow: 100,
        },
        "& .chakra-button__icon": {
            transitionProperty: "none",
            color: colorMode === "light" ? `gray.600` : `gray.100`,
        },
        "& .chakra-button__icon:last-child": {
            flexGrow: 1,
            justifyContent: "end",
        },
        "& .chakra-button__icon:last-child:nth-of-type(1)": {
            flexGrow: 0,
            justifyContent: "",
        },
    };
};

const sidebarGhost = (props) => {
    const { colorMode, colorScheme } = props;
    return {
        bg: "transparent",
        color: colorMode === "light" ? `gray.700` : `white`,
        fontWeight: "normal",
        transitionProperty: "none",
        justifyContent: "start",
        _hover: {
            bg: colorMode === "light" ? "blackAlpha.50" : "whiteAlpha.200",
        },
        _active: {
            bg: `${colorScheme}.500`,
            color: "white",
            "& .chakra-button__icon": {
                color: "white",
            },
        },
        "& > div": {
            flexGrow: 100,
        },
        "& .chakra-button__icon": {
            transitionProperty: "none",
            color: colorMode === "light" ? `gray.600` : `gray.100`,
        },
        "& .chakra-button__icon:last-child": {
            flexGrow: 1,
            justifyContent: "end",
        },
        "& .chakra-button__icon:last-child:nth-of-type(1)": {
            flexGrow: 0,
            justifyContent: "",
        },
    };
};

export const Button = {
    baseStyle: () => {
        return {
            borderRadius: "6px",
        };
    },
    defaultProps: {
        colorScheme: "primary",
    },
    variants: {
        solid,
        ghost,
        sidebar,
        sidebarGhost,
    },
};
