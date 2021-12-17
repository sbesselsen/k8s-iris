import React, { useEffect, useMemo, useState } from "react";

import { Context } from "../types/k8s";
import { useIpcCalls } from "./contexts/ipc";

import {
    Stack,
    Text,
    Link,
    FontWeights,
    IStackTokens,
    IStackStyles,
    ITextStyles,
    IContextualMenuProps,
} from "@fluentui/react";
import { DefaultButton } from "@fluentui/react/lib/Button";

const boldStyle: Partial<ITextStyles> = {
    root: { fontWeight: FontWeights.semibold },
};
const stackTokens: IStackTokens = { childrenGap: 15 };
const stackStyles: Partial<IStackStyles> = {
    root: {
        backgroundColor: "#f00",
        width: "960px",
        margin: "0 auto",
        textAlign: "center",
        color: "#605e5c",
    },
};

export const App: React.FunctionComponent = () => {
    const ipcCalls = useIpcCalls();

    const [contexts, setContexts] = useState<Context[]>([]);

    useEffect(() => {
        (async () => {
            setContexts(await ipcCalls.k8s.availableContexts());
        })();
    }, []);

    const menuProps: IContextualMenuProps = useMemo(
        () => ({
            shouldFocusOnMount: true,
            items: contexts.map((context) => ({
                key: context.name,
                text: context.name,
            })),
        }),
        [contexts]
    );

    return (
        <Stack
            horizontalAlign="center"
            verticalAlign="center"
            verticalFill
            styles={stackStyles}
            tokens={stackTokens}
        >
            <Text variant="xxLarge" styles={boldStyle}>
                Welcome to your Fluent UI app
            </Text>
            <Text variant="large">
                <DefaultButton
                    text="Click for ContextualMenu"
                    menuProps={menuProps}
                />
                For a guide on how to customize this project, check out the
                Fluent UI documentation.
            </Text>
            <Text variant="large" styles={boldStyle}>
                Essential links
            </Text>
            <Stack horizontal tokens={stackTokens} horizontalAlign="center">
                <Link href="https://developer.microsoft.com/en-us/fluentui#/get-started/web">
                    Docs
                </Link>
                <Link href="https://stackoverflow.com/questions/tagged/office-ui-fabric">
                    Stack Overflow
                </Link>
                <Link href="https://github.com/microsoft/fluentui/">
                    Github
                </Link>
                <Link href="https://twitter.com/fluentui">Twitter</Link>
            </Stack>
            <Text variant="large" styles={boldStyle}>
                Design system
            </Text>
            <Stack horizontal tokens={stackTokens} horizontalAlign="center">
                <Link href="https://developer.microsoft.com/en-us/fluentui#/styles/web/icons">
                    Icons
                </Link>
                <Link href="https://developer.microsoft.com/en-us/fluentui#/styles/web">
                    Styles
                </Link>
                <Link href="https://aka.ms/themedesigner">Theme designer</Link>
            </Stack>
        </Stack>
    );
};
