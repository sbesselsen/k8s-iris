import {
    forwardRef,
    TooltipProps,
    Tooltip,
    useColorModeValue,
} from "@chakra-ui/react";

export const AppTooltip = forwardRef<TooltipProps, "div">((props, ref) => {
    const bg = useColorModeValue("gray.100", "gray.800");
    const textColor = useColorModeValue("gray.900", "gray.100");
    return (
        <Tooltip
            bg={bg}
            color={textColor}
            fontWeight="normal"
            fontSize="xs"
            openDelay={250}
            {...props}
            ref={ref}
        />
    );
});
