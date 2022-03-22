import {
    BoxProps,
    Spinner,
    Stat,
    StatHelpText,
    StatLabel,
    StatNumber,
    useColorModeValue,
} from "@chakra-ui/react";
import React, { ReactNode } from "react";

export type BasicStatProps = BoxProps & {
    label: ReactNode;
    number?: ReactNode;
    isLoading?: boolean;
    helpText?: ReactNode;
};

export const BasicStat: React.FC<BasicStatProps> = (props) => {
    const {
        label,
        number,
        isLoading = false,
        helpText,
        children,
        ...boxProps
    } = props;

    const borderColor = useColorModeValue("primary.300", "primary.700");

    return (
        <Stat
            borderWidth="1px"
            borderColor={borderColor}
            p={3}
            borderRadius="lg"
            {...boxProps}
        >
            {label && <StatLabel>{label}</StatLabel>}
            <StatNumber>{isLoading ? <Spinner /> : number}</StatNumber>
            {helpText && <StatHelpText>{helpText}</StatHelpText>}
            {children}
        </Stat>
    );
};
