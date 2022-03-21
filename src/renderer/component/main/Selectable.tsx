import { Box, BoxProps, useOutsideClick } from "@chakra-ui/react";
import React, { useRef } from "react";

export type SelectableProps = BoxProps;

export const Selectable: React.FC<SelectableProps> = (props) => {
    const { children, userSelect = "text", ...boxProps } = props;
    const ref = useRef<HTMLDivElement>();
    useOutsideClick({
        ref,
        handler: () => {
            const selection = getSelection();
            if (
                ref.current &&
                selection.anchorNode &&
                ancestorsContains(selection.anchorNode, ref.current)
            ) {
                selection.empty();
            }
        },
    });

    return (
        <>
            <Box
                display="inline"
                userSelect={userSelect}
                {...boxProps}
                ref={ref}
            >
                {children}
            </Box>
        </>
    );
};

function ancestorsContains(nodeToCheck: Node, nodeToFind: Node): boolean {
    if (nodeToCheck === nodeToFind) {
        return true;
    }
    if (nodeToCheck.parentNode) {
        return ancestorsContains(nodeToCheck.parentNode, nodeToFind);
    }
    return false;
}
