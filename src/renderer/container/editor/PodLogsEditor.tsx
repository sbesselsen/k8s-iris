import { Box, Spinner, VStack } from "@chakra-ui/react";
import React, { Fragment, useEffect, useRef, useState } from "react";
import { useK8sLogWatchListener } from "../../k8s/log-watch";

export type PodLogsEditorProps = {
    name: string;
    namespace: string;
    containerName: string;
};

export const PodLogsEditor: React.FC<PodLogsEditorProps> = (props) => {
    const { name, namespace, containerName } = props;

    const logBottomRef = useRef<HTMLDivElement>();

    const [lines, setLines] = useState<string[]>([]);
    const [isEnded, setEnded] = useState(false);

    useEffect(() => {
        setLines([]);
        setEnded(false);
    }, [name, namespace, containerName, setEnded, setLines]);

    useEffect(() => {
        logBottomRef.current?.scrollIntoView();
    }, [lines, logBottomRef]);

    console.log("Lines", lines.length);

    useK8sLogWatchListener(
        {
            podName: name,
            namespace,
            containerName,
        },
        {
            onLogLines: (lines: string[]) => {
                setLines((oldLines) => [...oldLines, ...lines]);
            },
            onEnd: () => {
                setEnded(true);
            },
            timestamps: true,
            updateCoalesceInterval: 100,
        },
        [name, namespace, containerName, setEnded, setLines]
    );

    return (
        <VStack alignItems="stretch" flex="1 0 0">
            <Box
                flex="1 0 0"
                fontFamily="monospace"
                userSelect="text"
                cursor="text"
                bg="black"
                textColor="white"
                p={2}
                overflowY="scroll"
            >
                <Box whiteSpace="pre-line">{lines.join("\n")}</Box>
                <Box ref={logBottomRef} pt={2}>
                    {isEnded ? (
                        "(log ended)"
                    ) : (
                        <Spinner
                            size="sm"
                            speed="1.2s"
                            color="gray.300"
                            emptyColor="gray.700"
                        />
                    )}
                </Box>
            </Box>
        </VStack>
    );
};
