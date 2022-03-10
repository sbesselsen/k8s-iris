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
import { useColorTheme } from "../../context/color-theme";
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

        const { colorScheme } = useColorTheme() ?? { colorScheme: "gray" };

        const searchBackground = useColorModeValue(
            colorScheme + useWindowFocusValue(".100", ".300"),
            colorScheme + useWindowFocusValue(".800", ".900")
        );
        const searchFocusedBackground = useColorModeValue("white", "black");
        const itemTextColor = useColorModeValue(colorScheme + ".900", "white");
        const itemPlaceholderColor = useColorModeValue(
            useWindowFocusValue(colorScheme + ".600", colorScheme + ".600"),
            useWindowFocusValue(colorScheme + ".100", colorScheme + ".400")
        );

        const iconColor = itemPlaceholderColor;
        return (
            <InputGroup size="sm">
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
