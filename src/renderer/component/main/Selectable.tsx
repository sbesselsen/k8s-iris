import { Box, BoxProps, useOutsideClick } from "@chakra-ui/react";
import React, { MutableRefObject, useRef } from "react";

export type SelectableProps = BoxProps & {
    containerRef?: MutableRefObject<HTMLElement>;
};

export const Selectable: React.FC<SelectableProps> = (props) => {
    const { children, containerRef, userSelect = "text", ...boxProps } = props;
    const ref = useRef<HTMLDivElement>();
    useOutsideClick({
        ref: (containerRef ?? ref) as MutableRefObject<HTMLElement>,
        handler: () => {
            const selection = getSelection();
            if (
                ref.current &&
                selection &&
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
                as="span"
                cursor="text"
                userSelect={userSelect}
                {...boxProps}
                ref={ref as MutableRefObject<HTMLDivElement>}
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
