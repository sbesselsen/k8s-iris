import {
    Box,
    HStack,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    useColorModeValue,
    useToken,
} from "@chakra-ui/react";
import React, { ReactNode, useCallback, useMemo, useRef } from "react";
import { HibernateContainer } from "../../context/hibernate";
import { ParamNamespace } from "../../context/param";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useWindowFocusValue } from "../../hook/window-focus";
import { LazyComponent } from "./LazyComponent";

export type ContentTab = {
    id: string;
    title: string;
    content: ReactNode;
};

export type ContentTabsProps = {
    tabs: ContentTab[];
    selected?: string;
    onChangeSelection?: (selection: string, requestNewWindow?: boolean) => void;
    isLazy?: boolean | "lazy-create";
};

export const ContentTabs: React.FC<ContentTabsProps> = (props) => {
    const { isLazy = false, onChangeSelection, selected, tabs } = props;

    let tabIndex = tabs.findIndex((tab) => selected && tab.id === selected);
    if (tabIndex === -1) {
        tabIndex = 0;
    }
    const tabIndexRef = useRef(tabIndex);
    const metaKeyRef = useModifierKeyRef("Meta");
    const onChangeTabIndex = useCallback(
        (index: number) => {
            if (index >= 0 && tabs.length > index) {
                onChangeSelection?.(tabs[index].id, metaKeyRef.current);
            }
        },
        [metaKeyRef, onChangeSelection, tabIndexRef]
    );

    // We set onClick on Tab instead of onChange on Tabs because Tabs calls
    // onChange multiple times in sequence, causing trouble when we request
    // a new window.
    const onChangeTabIndexes = useMemo(
        () =>
            tabs.map((_, index) => () => {
                onChangeTabIndex(index);
            }),
        [onChangeTabIndex]
    );

    return (
        <Tabs
            display="flex"
            w="100%"
            h="100%"
            flexDirection="column"
            variant="content"
            size="xs"
            index={tabIndex}
            isLazy={isLazy === "lazy-create" ? false : isLazy}
        >
            <TabList flex="0 0 0">
                {tabs.map((tab, index) => (
                    <Tab key={tab.id} onClick={onChangeTabIndexes[index]}>
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
                        flexDirection="column"
                        flex="1 0 0"
                        overflow="hidden"
                        p={0}
                    >
                        <ParamNamespace name={tab.id}>
                            <LazyComponent
                                isActive={
                                    isLazy !== "lazy-create" ||
                                    tab.id === selected
                                }
                            >
                                <HibernateContainer
                                    hibernate={tab.id !== selected}
                                >
                                    {tab.content}
                                </HibernateContainer>
                            </LazyComponent>
                        </ParamNamespace>
                    </TabPanel>
                ))}
            </TabPanels>
        </Tabs>
    );
};
