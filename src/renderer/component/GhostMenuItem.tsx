import React from "react";
import { MenuItem, MenuItemProps, useColorModeValue } from "@chakra-ui/react";

/**
 * Cannot theme MenuItems with variants so this will have to do.
 */
export const GhostMenuItem: React.FC<MenuItemProps> = (props) => {
    const focusBgAlpha = useColorModeValue("0.4", "0.2");
    const activeBgAlpha = useColorModeValue("0.6", "0.4");

    return (
        <MenuItem
            _focus={{
                bg: `rgba(255, 255, 255, ${focusBgAlpha})`,
            }}
            _active={{
                bg: `rgba(255, 255, 255, ${activeBgAlpha})`,
            }}
            {...props}
        />
    );
};
