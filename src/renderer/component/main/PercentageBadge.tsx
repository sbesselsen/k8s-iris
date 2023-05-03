import {
    Badge,
    BadgeProps,
    Box,
    forwardRef,
    useColorModeValue,
} from "@chakra-ui/react";

export const PercentageBadge = forwardRef<
    {
        value: number;
        label?: string;
        colorScheme: string;
        size?: string;
    } & BadgeProps,
    any
>((props, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { value, label, colorScheme, size, ...badgeProps } = props;

    const bgColor = useColorModeValue(
        colorScheme + ".100",
        colorScheme + ".700"
    );
    const barColor = useColorModeValue(
        colorScheme + ".500",
        colorScheme + ".400"
    );

    return (
        <Badge
            bg={bgColor}
            position="relative"
            px={0}
            overflow="hidden"
            textAlign="center"
            {...badgeProps}
            ref={ref}
        >
            <Box
                position="absolute"
                zIndex={0}
                bg={barColor}
                w={Math.round(100 * value) + "%"}
                transition="width 500ms ease-in-out"
                h="100%"
            ></Box>
            <Box position="relative" px={2}>
                {label ?? "\u00a0"}
            </Box>
        </Badge>
    );
});
