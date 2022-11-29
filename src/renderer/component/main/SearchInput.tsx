import { SearchIcon } from "@chakra-ui/icons";
import {
    Input,
    InputGroup,
    InputLeftElement,
    useColorModeValue,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    KeyboardEvent,
    useCallback,
    useEffect,
    useState,
} from "react";

export type SearchInputProps = {
    value: string;
    onChange: (value: string) => void;
    shouldShowIcon?: boolean;
};

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    (props, ref) => {
        const { value, onChange, shouldShowIcon = true } = props;

        const [innerValue, setInnerValue] = useState("");
        useEffect(() => {
            setInnerValue(value);
        }, [setInnerValue, value]);

        const onChangeCallback = useCallback(
            (e: ChangeEvent<HTMLInputElement>) => {
                setInnerValue(e.target.value);
            },
            [onChange]
        );

        const onClick = useCallback(() => {
            onChange(innerValue);
        }, [innerValue, onChange]);

        const onKeyUp = useCallback(
            (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    onChange(innerValue);
                }
                if (e.key === "Escape") {
                    setInnerValue("");
                    onChange("");
                }
            },
            [innerValue, onChange, setInnerValue]
        );

        const searchBackground = useColorModeValue("gray.100", "gray.800");
        const searchFocusedBackground = useColorModeValue(
            "gray.200",
            "gray.700"
        );
        const itemTextColor = useColorModeValue("black", "white");
        const itemPlaceholderColor = useColorModeValue("gray.600", "gray.100");

        const iconColor = itemPlaceholderColor;
        return (
            <InputGroup size="sm">
                {shouldShowIcon && (
                    <InputLeftElement
                        children={<SearchIcon />}
                        color={iconColor}
                        onClick={onClick}
                    />
                )}
                <Input
                    placeholder="Search"
                    borderRadius="md"
                    bg={searchBackground}
                    border={0}
                    transition="none"
                    textColor={itemTextColor}
                    _placeholder={{
                        textColor: itemPlaceholderColor,
                    }}
                    _focus={{
                        bg: searchFocusedBackground,
                        boxShadow: "none",
                    }}
                    _focusVisible={{ boxShadow: "outline" }}
                    sx={{ WebkitAppRegion: "no-drag" }}
                    value={innerValue}
                    onChange={onChangeCallback}
                    onKeyUp={onKeyUp}
                    ref={ref}
                />
            </InputGroup>
        );
    }
);
