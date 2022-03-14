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

    const tabsBorderColor = useColorModeValue("primary.100", "primary.900");
    const focusBoxShadow = useToken("shadows", "outline");

    const opacity = useWindowFocusValue(1.0, 0.7);

    return (
        <Tabs
            display="flex"
            w="100%"
            h="100%"
            flexDirection="column"
            variant="line"
            colorScheme="primary"
        >
            <TabList
                flex="0 0 0"
                borderBottomColor={tabsBorderColor}
                opacity={opacity}
                pt={1}
                mx={2}
            >
                {tabs.map((tab) => (
                    <Tab
                        key={tab.id}
                        _focus={{}}
                        _focusVisible={{
                            boxShadow: focusBoxShadow,
                        }}
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
