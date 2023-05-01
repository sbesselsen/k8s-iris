import { AddIcon } from "@chakra-ui/icons";
import React, { useCallback } from "react";
import {
    K8sObject,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import { Toolbar } from "../../component/main/Toolbar";
import { useKeyListener } from "../../hook/keyboard";
import { useK8sDeleteAction } from "../../k8s/actions";
import { ResourceActionButtons } from "./ResourceActionButtons";

export type ResourcesToolbarProps = {
    resourceType?: K8sResourceTypeIdentifier;
    resources?: K8sObject[];
    onClearSelection?: () => void;
};

export const ResourcesToolbar: React.FC<ResourcesToolbarProps> = (props) => {
    const { onClearSelection, resources = [] } = props;

    const deleteResource = useK8sDeleteAction();

    const onClickDelete = useCallback(async () => {
        const { willDelete } = await deleteResource(resources);
        if (willDelete) {
            onClearSelection?.();
        }
    }, [deleteResource, resources, onClearSelection]);

    useKeyListener(
        useCallback(
            (event, key) => {
                if (event === "keydown" && key === "Delete") {
                    if (resources?.length > 0) {
                        onClickDelete();
                    }
                }
            },
            [onClickDelete, resources]
        )
    );

    if (resources.length === 0) {
        return null;
    }

    return (
        <Toolbar>
            <ResourceActionButtons resources={resources} />
        </Toolbar>
    );
};
