import { CheckIcon, CopyIcon } from "@chakra-ui/icons";
import { Button, ButtonProps, useClipboard } from "@chakra-ui/react";
import React from "react";

export type CopyableProps = ButtonProps & {
    value: string;
};

export const Copyable: React.FC<CopyableProps> = (props) => {
    const { children, value, ...buttonProps } = props;
    const { onCopy, hasCopied } = useClipboard(value);

    return (
        <>
            {children}
            <Button
                colorScheme="primary"
                variant="ghost"
                size="sm"
                ms={2}
                {...buttonProps}
                onClick={onCopy}
            >
                {hasCopied ? <CheckIcon /> : <CopyIcon />}
            </Button>
        </>
    );
};
