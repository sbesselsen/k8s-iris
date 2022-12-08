import { Link, LinkProps } from "@chakra-ui/react";
import React from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { useEditorLink } from "../../hook/editor-link";
import { ResourceContextMenu } from "./ResourceContextMenu";

export type ResourceEditorLinkProps = LinkProps & {
    editorResource: K8sObject | K8sObjectIdentifier;
};

export const ResourceEditorLink: React.FC<ResourceEditorLinkProps> = (
    props
) => {
    const { editorResource, ...linkProps } = props;
    const { openEditor } = useEditorLink(editorResource);
    return (
        <ResourceContextMenu object={editorResource}>
            <Link onClick={openEditor} {...linkProps} />
        </ResourceContextMenu>
    );
};
