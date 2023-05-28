import { Box, BoxProps } from "@chakra-ui/react";
import { k8sAccountIdColor } from "../../util/k8s-context-color";

export const ContextIcon: React.FC<
    BoxProps & { colorId?: string | null | undefined }
> = (props) => {
    const { colorId, ...boxProps } = props;
    const { colorScheme } = k8sAccountIdColor(colorId ?? null);
    return (
        <Box
            w="11px"
            h="11px"
            borderRadius="sm"
            bg={colorScheme + ".500"}
            {...boxProps}
        ></Box>
    );
};
