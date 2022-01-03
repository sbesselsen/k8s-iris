import { Button, Icon } from "@chakra-ui/react";
import React, { useMemo } from "react";

import { FaAws, FaCode } from "react-icons/fa";

import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";

export type K8sContextLabelProps = {
    context: K8sContext;
    cloudInfo?: CloudK8sContextInfo;
    isSelected?: boolean;
    onClick?: () => void;
};

export const K8sContextLabel: React.FC<K8sContextLabelProps> = (props) => {
    const { context, cloudInfo, onClick, isSelected } = props;

    const icon = useMemo(() => {
        switch (cloudInfo?.cloudProvider) {
            case "aws":
                return <Icon as={FaAws} />;
            case "local":
                return <Icon as={FaCode} />;
            default:
                return null;
        }
    }, [cloudInfo]);

    const localName = useMemo(() => {
        return cloudInfo?.localClusterName ?? context.name;
    }, [context, cloudInfo]);

    return (
        <Button
            onClick={onClick}
            bgColor={isSelected ? "green.200" : "transparent"}
            borderRadius={0}
            isFullWidth={true}
            size="sm"
            fontWeight="normal"
            justifyContent="flex-start"
            leftIcon={icon}
        >
            {localName}
        </Button>
    );
};
