import React from "react";
import { MenuItem, MenuItemProps } from "@chakra-ui/react";

/**
 * Cannot theme MenuItems with variants so this will have to do.
 */
export const GhostMenuItem: React.FC<MenuItemProps> = (props) => {
    return (
        <MenuItem
            _focus={{
                bg: "rgba(255, 255, 255, 0.2)",
            }}
            _active={{
                bg: "rgba(255, 255, 255, 0.5)",
            }}
            {...props}
        />
    );
};
