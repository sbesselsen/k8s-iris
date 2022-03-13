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
import { useWindowFocusValue } from "../../hook/window-focus";

export type SearchInputProps = {
    value: string;
    onChange: (value: string) => void;
};

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    (props, ref) => {
        const { value, onChange } = props;

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

        const opacity = useWindowFocusValue(1.0, 0.5);

        const searchBackground = useColorModeValue(
            useWindowFocusValue("primary.100", "primary.200"),
            useWindowFocusValue("primary.800", "primary.900")
        );
        const searchFocusedBackground = useColorModeValue("white", "black");
        const itemTextColor = useColorModeValue("primary.900", "white");
        const itemPlaceholderColor = useColorModeValue(
            "primary.600",
            "primary.100"
        );

        const iconColor = itemPlaceholderColor;
        return (
            <InputGroup size="sm" opacity={opacity}>
                <InputLeftElement
                    children={<SearchIcon />}
                    color={iconColor}
                    onClick={onClick}
                />
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
                    }}
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
