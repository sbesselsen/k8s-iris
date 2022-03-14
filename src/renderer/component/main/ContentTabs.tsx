import {
    Box,
    Tab,
    Table,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    useColorModeValue,
    useToken,
    VStack,
} from "@chakra-ui/react";
import React, { ReactNode } from "react";
import { useWindowFocusValue } from "../../hook/window-focus";
import { ScrollBox } from "./ScrollBox";

export type ContentTab = {
    id: string;
    title: string;
    content: ReactNode;
};

export type ContentTabsProps = {
    tabs: ContentTab[];
};

export const ContentTabs: React.FC<ContentTabsProps> = (props) => {
    const { tabs } = props;

    const primaryColorIsGray =
        useToken("colors", "primary.500") === useToken("colors", "gray.500");
    const tabsBackgroundColor = useColorModeValue(
        "primary.100",
        primaryColorIsGray ? "primary.800" : "primary.900"
    );
    const focusBoxShadow = useToken("shadows", "outline");

    const tabTextColor = useColorModeValue("primary.900", "white");
    const selectedTabTextColor = "white";
    const selectedTabBackgroundColor = "primary.500";

    const opacity = useWindowFocusValue(1.0, 0.5);

    return (
        <Tabs
            display="flex"
            w="100%"
            h="100%"
            flexDirection="column"
            variant="soft-rounded"
            colorScheme="primary"
        >
            <TabList
                flex="0 0 0"
                borderRadius={6}
                bg={tabsBackgroundColor}
                opacity={opacity}
                m={2}
            >
                {tabs.map((tab) => (
                    <Tab
                        key={tab.id}
                        borderRadius={6}
                        _focus={{}}
                        fontWeight="normal"
                        textColor={tabTextColor}
                        _focusVisible={{
                            boxShadow: focusBoxShadow,
                        }}
                        _selected={{
                            bg: selectedTabBackgroundColor,
                            textColor: selectedTabTextColor,
                        }}
                        me={1}
                    >
                        {tab.title}
                    </Tab>
                ))}
            </TabList>
            <TabPanels
                flex="1 0 0"
                display="flex"
                overflow="hidden"
                flexDirection="column"
            >
                {tabs.map((tab) => (
                    <TabPanel
                        key={tab.id}
                        display="flex"
                        flex="1 0 0"
                        overflow="hidden"
                        p={0}
                    >
                        <ScrollBox>{tab.content}</ScrollBox>
                    </TabPanel>
                ))}
            </TabPanels>
        </Tabs>
    );
};
