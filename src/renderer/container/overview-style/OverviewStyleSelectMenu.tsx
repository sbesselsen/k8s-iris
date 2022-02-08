import {
    Button,
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuList,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import React, { useMemo } from "react";
import {
    OverviewStyle,
    useAppRoute,
    useAppRouteActions,
} from "../../context/route";
import { menuGroupStylesHack } from "../../theme";

const overviewStyleTitles: Record<OverviewStyle, string> = {
    cluster_info: "Cluster info",
    cluster_nodes: "Nodes",
    applications: "Applications",
    custom_objects: "Custom objects",
};

const options: Array<{
    groupTitle: string;
    overviewStyles: Array<{
        value: OverviewStyle;
        label: string;
    }>;
}> = [
    {
        groupTitle: "Cluster",
        overviewStyles: [
            { value: "cluster_info", label: "Info" },
            { value: "cluster_nodes", label: "Nodes" },
        ],
    },
    {
        groupTitle: "Workloads",
        overviewStyles: [{ value: "applications", label: "Applications" }],
    },
    {
        groupTitle: "Objects",
        overviewStyles: [{ value: "custom_objects", label: "Custom objects" }],
    },
];

export const OverviewStyleSelectMenu: React.FunctionComponent = () => {
    const { overviewStyle } = useAppRoute();
    const { selectOverviewStyle } = useAppRouteActions();

    const title = overviewStyleTitles[overviewStyle] ?? "";

    const onClickOptions = useMemo(() => {
        const overviewStyles = Object.keys(
            overviewStyleTitles
        ) as OverviewStyle[];
        return Object.fromEntries(
            overviewStyles.map((style) => [
                style,
                () => {
                    selectOverviewStyle(style);
                },
            ])
        );
    }, [selectOverviewStyle]);

    return (
        <Menu>
            <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                variant="ghost"
            >
                {title}
            </MenuButton>
            <MenuList sx={menuGroupStylesHack}>
                {options.map(({ groupTitle, overviewStyles }, i) => (
                    <MenuGroup title={groupTitle} key={i}>
                        {overviewStyles.map(({ value, label }) => (
                            <MenuItem onClick={onClickOptions[value]}>
                                {label}
                            </MenuItem>
                        ))}
                    </MenuGroup>
                ))}
            </MenuList>
        </Menu>
    );
};
