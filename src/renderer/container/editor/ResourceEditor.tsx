import { Box, Checkbox, HStack, VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import {
    K8sObjectHeading,
    K8sObjectViewer,
    K8sResourceDisplayRule,
} from "../../component/k8s/K8sObjectViewer";
import { ContentTabs } from "../../component/main/ContentTabs";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";
import { useK8sListWatch } from "../../k8s/list-watch";

export type ResourceEditorProps = {
    editorResource: K8sObjectIdentifier;
};

const displayRules: K8sResourceDisplayRule[] = [
    {
        selector: ".",
        displayAs: "accordion",
        keysOrder: ["metadata", "spec", "*", "status"],
    },
    {
        selector: ".apiVersion",
        displayAs: "hidden",
    },
    {
        selector: ".kind",
        displayAs: "hidden",
    },
    {
        selector: ".metadata",
        keysOrder: [
            "name",
            "namespace",
            "annotations",
            "labels",
            "*",
            "ownerReferences",
            "managedFields",
        ],
    },
    {
        selector: ".spec",
        keysOrder: ["containers", "volumes", "*"],
    },
    {
        selector: ".spec.containers",
        autoExpandSingleItem: true,
    },
    {
        selector: ".status.podIPs",
        autoExpandSingleItem: true,
    },
    {
        selector: "..annotations",
        displayAs: "string-key-pair",
    },
    {
        selector: "..labels",
        displayAs: "string-key-pair",
        keyValueSeparator: "=",
    },
];

const detailSelectors: string[] = [
    "..resourceVersion",
    "..managedFields",
    "..uid",
    "..providerID",
    "..finalizers",
    ".metadata.generateName",
    ".metadata.ownerReferences",
    ".spec.containers.terminationMessagePath",
    ".spec.containers.terminationMessagePolicy",
    ".spec.dnsPolicy",
    ".spec.enableServiceLinks",
    ".spec.nodeName",
    ".spec.preemptionPolicy",
    ".spec.priority",
    ".spec.priorityClassName",
    ".spec.restartPolicy",
    ".spec.schedulerName",
    ".spec.terminationGracePeriodSeconds",
    ".spec.tolerations",
    ".status.qosClass",
    ".status.containerStatuses.containerID",
];

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

type ResourceViewerProps = {
    object: K8sObject | undefined;
};

const detailedDisplayRules = displayRules;
const undetailedDisplayRules = [
    ...displayRules,
    ...detailSelectors.map(
        (selector) =>
            ({
                selector,
                displayAs: "hidden",
            } as const)
    ),
];

const ResourceViewer: React.FC<ResourceViewerProps> = React.memo((props) => {
    const { object } = props;

    const kind = object?.kind;
    const apiVersion = object?.apiVersion;
    const metadata = object?.metadata;

    const [showDetails, setShowDetails] = useAppParam("showDetails", false);
    const toggleDetails = useCallback(() => {
        setShowDetails((x) => !x, true);
    }, [setShowDetails]);

    if (!kind || !apiVersion || !metadata) {
        return null;
    }

    return (
        <ScrollBox px={4} py={2}>
            <VStack spacing={4} alignItems="stretch">
                <HStack alignItems="baseline">
                    <K8sObjectHeading
                        kind={kind}
                        apiVersion={apiVersion}
                        metadata={metadata}
                        flex="1 0 0"
                    />
                    <Box>
                        <Checkbox
                            onChange={toggleDetails}
                            isChecked={showDetails}
                            colorScheme="primary"
                        >
                            Show details
                        </Checkbox>
                    </Box>
                </HStack>
                {object && (
                    <K8sObjectViewer
                        data={object}
                        displayRules={
                            showDetails
                                ? detailedDisplayRules
                                : undetailedDisplayRules
                        }
                    />
                )}
            </VStack>
        </ScrollBox>
    );
});
