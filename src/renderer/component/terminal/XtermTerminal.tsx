import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button } from "@chakra-ui/react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export const XtermTerminal: React.FC<{}> = (props) => {
    const containerRef = useRef<HTMLDivElement>();

    const [height, setHeight] = useState(200);
    const onClick = useCallback(() => {
        setHeight((h) => h + 50);
    }, [setHeight]);

    useEffect(() => {
        const term = new Terminal();
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);

        fitAddon.fit();

        term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");
        return () => {
            term.dispose();
        };
    }, [containerRef]);

    return (
        <Box>
            <Button onClick={onClick}>klik</Button>
            <Box
                w="300px"
                h={height + "px"}
                bg="red"
                border="2px solid yellow"
                ref={containerRef}
            ></Box>
        </Box>
    );
};
