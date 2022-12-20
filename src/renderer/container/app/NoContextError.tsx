import { Code, Heading, Text, VStack } from "@chakra-ui/react";
import React from "react";
export const NoContextError: React.FC<{}> = () => {
    return (
        <VStack
            spacing={6}
            mt={6}
            alignItems="start"
            ps={4}
            pe={12}
            maxWidth="800px"
        >
            <Heading size="md">No context selected</Heading>
            <Text fontSize="sm" userSelect="text">
                This could be due to a missing or malformed{" "}
                <Code>.kube/config</Code> file. Please check your config and
                restart the application.
            </Text>
        </VStack>
    );
};
