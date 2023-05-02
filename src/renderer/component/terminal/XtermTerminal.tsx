import React, { MutableRefObject, useEffect, useRef } from "react";
import { Box, BoxProps, VStack } from "@chakra-ui/react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import {
    useHibernateGetter,
    useHibernateListener,
} from "../../context/hibernate";
import { useAppContentResizeListener } from "../main/AppFrame";
import { WebLinksAddon } from "xterm-addon-web-links";
import { useModifierKeyRef } from "../../hook/keyboard";

export type XtermTerminalProps = BoxProps & {
    onInitializeTerminal?: (terminal: Terminal) => void;
    onClickLink?: (uri: string) => void;
};

export const XtermTerminal: React.FC<XtermTerminalProps> = (props) => {
    const { onClickLink, onInitializeTerminal, ...boxProps } = props;

    const containerRef = useRef<HTMLDivElement>();
    const fitAddonRef = useRef<FitAddon>();
    const termRef = useRef<Terminal>();

    const metaKeyRef = useModifierKeyRef("Meta");

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const term = new Terminal({
            fontFamily: "JetBrainsMono",
            fontSize: 12,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (onClickLink) {
            const linksAddon = new WebLinksAddon((e, uri) => {
                if (metaKeyRef.current) {
                    onClickLink?.(uri);
                }
            });
            term.loadAddon(linksAddon);
        }

        term.open(containerRef.current);

        fitAddon.fit();
        fitAddonRef.current = fitAddon;

        termRef.current = term;

        return () => {
            term.dispose();
            termRef.current = undefined;
        };
    }, [containerRef, fitAddonRef, metaKeyRef, onClickLink, termRef]);

    useEffect(() => {
        if (termRef.current && onInitializeTerminal) {
            onInitializeTerminal(termRef.current);
        }
    }, [onInitializeTerminal, termRef]);

    useHibernateListener(
        (isPaused) => {
            if (!isPaused) {
                fitAddonRef.current?.fit();
            }
        },
        [fitAddonRef]
    );
    const getHibernate = useHibernateGetter();

    useAppContentResizeListener(() => {
        if (!getHibernate()) {
            fitAddonRef.current?.fit();
        }
    }, [containerRef, fitAddonRef, getHibernate]);

    return (
        <VStack bg="black" p={2} {...boxProps} spacing={0} alignItems="stretch">
            <Box
                flex="1 0 0"
                overflow="hidden"
                ref={containerRef as MutableRefObject<HTMLDivElement>}
            />
        </VStack>
    );
};
