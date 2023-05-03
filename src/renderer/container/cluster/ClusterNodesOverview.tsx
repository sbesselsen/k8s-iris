import React from "react";
import { ResourceTypeOverview } from "../resources/ResourceAllOverview";

const nodeResourceType = {
    apiVersion: "v1",
    kind: "Node",
};

export const ClusterNodesOverview: React.FC = () => {
    return (
        <ResourceTypeOverview
            resourceType={nodeResourceType}
        ></ResourceTypeOverview>
    );
};
