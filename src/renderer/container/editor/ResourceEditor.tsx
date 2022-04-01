import { Box } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { ContentTabs } from "../../component/main/ContentTabs";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";
import { useK8sListWatch } from "../../k8s/list-watch";

export type ResourceEditorProps = {
    editorResource: K8sObjectIdentifier;
};

export const ResourceEditor: React.FC<ResourceEditorProps> = (props) => {
    const { editorResource } = props;

    const [_isLoadingObjects, objects, _objectsError] = useK8sListWatch(
        {
            apiVersion: editorResource.apiVersion,
            kind: editorResource.kind,
            ...(editorResource.namespace
                ? { namespaces: [editorResource.namespace] }
                : {}),
        },
        {},
        [editorResource]
    );

    const object = useMemo(
        () =>
            objects?.items?.find(
                (item) => item.metadata.name === editorResource.name
            ),
        [objects]
    );

    const [activeTab, setActiveTab] = useAppParam("tab", "view");

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: setActiveTab.asRoute(id),
                });
            } else {
                setActiveTab(id);
            }
        },
        [createWindow, setActiveTab]
    );

    const tabs = [
        {
            id: "view",
            title: "View",
            content: <ResourceViewer object={object} />,
        },
        { id: "edit", title: "Edit", content: <Box /> },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={activeTab}
            onChangeSelection={onChangeTabSelection}
            isLazy
        />
    );
};

const ResourceViewer: React.FC<{ object: K8sObject | undefined }> = (props) => {
    const { object } = props;

    const [showCruft, setShowCruft] = useAppParam("showCruft", false);

    return (
        <Box w="100%">
            <pre>{JSON.stringify(object)}</pre>
        </Box>
    );
};
