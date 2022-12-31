import React, { MutableRefObject, useEffect, useRef } from "react";
import { Box, BoxProps, VStack } from "@chakra-ui/react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useHibernate } from "../../context/hibernate";
import { useAppContentResizeListener } from "../main/AppFrame";

export type XtermTerminalProps = BoxProps & {
    onInitializeTerminal?: (terminal: Terminal) => void;
};

export const XtermTerminal: React.FC<XtermTerminalProps> = (props) => {
    const { onInitializeTerminal, ...boxProps } = props;

    const containerRef = useRef<HTMLDivElement>();
    const fitAddonRef = useRef<FitAddon>();
    const termRef = useRef<Terminal>();

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

        term.open(containerRef.current);

        fitAddon.fit();
        fitAddonRef.current = fitAddon;

        termRef.current = term;

        return () => {
            term.dispose();
            termRef.current = undefined;
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
            fitAddonRef.current?.fit();
        }
    }, [containerRef, isPaused, isPausedRef]);

    useAppContentResizeListener(() => {
        if (!isPausedRef.current) {
            fitAddonRef.current?.fit();
        }
    }, [containerRef, fitAddonRef, isPausedRef]);

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
