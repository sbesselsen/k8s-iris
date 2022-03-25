import { Box } from "@chakra-ui/react";
import React, { useEffect } from "react";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { useK8sClient } from "../../k8s/client";

export const ResourceAllOverview: React.FC = () => {
    const [_isLoadingResources, resources, _resourcesError] =
        useK8sApiResourceTypes();

    return (
        <ScrollBox px={4} py={2}>
            {resources?.map((resource) => (
                <Box key={resource.apiVersion + " " + resource.kind}>
                    {resource.apiVersion + " " + resource.kind}
                </Box>
            ))}
        </ScrollBox>
    );
};
