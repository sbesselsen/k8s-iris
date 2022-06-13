import React, { useEffect, useRef } from "react";
import { Box, BoxProps, VStack } from "@chakra-ui/react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useWindowResizeListener } from "../../hook/window-resize";
import { useHibernate } from "../../context/hibernate";

export type XtermTerminalProps = BoxProps & {
    onInitializeTerminal?: (terminal: Terminal) => void;
};

export const XtermTerminal: React.FC<XtermTerminalProps> = (props) => {
    const { onInitializeTerminal, ...boxProps } = props;

    const containerRef = useRef<HTMLDivElement>();
    const fitAddonRef = useRef<FitAddon>();
    const termRef = useRef<Terminal>();

    useEffect(() => {
        const term = new Terminal();
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);

        fitAddon.fit();
        fitAddonRef.current = fitAddon;

        termRef.current = term;

        return () => {
            term.dispose();
            termRef.current = null;
        };
    }, [containerRef, fitAddonRef, termRef]);

    useEffect(() => {
        if (termRef.current && onInitializeTerminal) {
            onInitializeTerminal(termRef.current);
        }
    }, [onInitializeTerminal, termRef]);

    const isPaused = useHibernate();
    const isPausedRef = useRef(isPaused);
    useEffect(() => {
        isPausedRef.current = isPaused;
        if (!isPaused) {
            fitAddonRef?.current.fit();
        }
    }, [containerRef, isPaused, isPausedRef]);

    useWindowResizeListener(() => {
        if (!isPausedRef.current) {
            fitAddonRef.current.fit();
        }
    }, [containerRef, fitAddonRef, isPausedRef]);

    return (
        <VStack bg="black" p={2} {...boxProps} spacing={0} alignItems="stretch">
            <Box flex="1 0 0" overflow="hidden" ref={containerRef} />
        </VStack>
    );
};
