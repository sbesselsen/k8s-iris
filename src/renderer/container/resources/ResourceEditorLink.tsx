import { HStack, Link, LinkProps } from "@chakra-ui/react";
import React from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { useEditorLink } from "../../hook/editor-link";
import {
    ResourceContextMenu,
    ResourceContextMenuTriggerButton,
} from "./ResourceContextMenu";

export type ResourceEditorLinkProps = LinkProps & {
    editorResource: K8sObject | K8sObjectIdentifier;
    showMenuAffordance?: boolean;
};

export const ResourceEditorLink: React.FC<ResourceEditorLinkProps> = (
    props
) => {
    const { editorResource, showMenuAffordance = true, ...linkProps } = props;
    const { openEditor } = useEditorLink(editorResource);
    return (
        <ResourceContextMenu object={editorResource}>
            <HStack
                display={linkProps.display ?? "inline-flex"}
                fontSize={linkProps.fontSize ?? "inherit"}
                alignItems="center"
                overflow="hidden"
                cursor="pointer"
                spacing={0}
            >
                <Link onClick={openEditor} isTruncated {...linkProps} />
                {showMenuAffordance && <ResourceContextMenuTriggerButton />}
            </HStack>
        </ResourceContextMenu>
    );
};
