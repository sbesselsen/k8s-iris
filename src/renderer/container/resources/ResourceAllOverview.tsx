import {
    Accordion,
    AccordionButton,
    AccordionItem,
    AccordionPanel,
    Box,
    Button,
    Heading,
    HStack,
    useColorModeValue,
    useToken,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import {
    K8sResourceTypeIdentifier,
    K8sResourceTypeInfo,
} from "../../../common/k8s/client";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useAppParam } from "../../context/param";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";

type GroupedResourceGroup = { groupName: string; resources: GroupedResource[] };
type GroupedResource = { kindName: string; versions: GroupedResourceVersion[] };
type GroupedResourceVersion = {
    versionName: string;
    resource: K8sResourceTypeInfo;
};

export const ResourceAllOverview: React.FC = () => {
    const [_isLoadingResources, resources, _resourcesError] =
        useK8sApiResourceTypes();

    const groupedResources = useMemo(
        () => groupResources(resources ?? []),
        [resources]
    );

    const sortedResources = useMemo(
        () => sortResources(groupedResources),
        [groupedResources]
    );

    const [expandedResourceGroup, setExpandedResourceGroup] = useAppParam<
        string | undefined
    >("group", undefined);
    const expandedIndex = useMemo(
        () =>
            sortedResources.findIndex(
                (res) => res.groupName === expandedResourceGroup
            ),
        [expandedResourceGroup, sortedResources]
    );
    const onChangeExpandedIndex = useCallback(
        (index: number) => {
            setExpandedResourceGroup(sortedResources[index]?.groupName, true);
        },
        [setExpandedResourceGroup, sortedResources]
    );

    const [selectedResource, setSelectedResource] = useAppParam<
        K8sResourceTypeIdentifier | undefined
    >("resourceType", undefined);

    const selectedGroupedResource = useMemo(
        () =>
            sortedResources
                .flatMap(({ groupName, resources }) =>
                    resources.map((resource) => ({ groupName, resource }))
                )
                .find(
                    ({ groupName, resource }) =>
                        resource.versions.some(
                            (version) =>
                                [groupName, version.versionName]
                                    .filter((x) => x)
                                    .join("/") === selectedResource?.apiVersion
                        ) && resource.kindName === selectedResource?.kind
                )?.resource,
        [selectedResource, sortedResources]
    );

    return (
        <HStack flex="1 0 0" overflow="hidden" spacing={0} alignItems="stretch">
            <ScrollBox px={2} py={2} flex="0 0 250px">
                <Accordion
                    index={expandedIndex}
                    onChange={onChangeExpandedIndex}
                    allowToggle
                >
                    {sortedResources?.map((group) => (
                        <ResourceGroupMenu
                            key={group.groupName}
                            selectedResource={selectedResource}
                            onSelectResource={setSelectedResource}
                            group={group}
                        />
                    ))}
                </Accordion>
            </ScrollBox>
            <ScrollBox px={4} py={2} flex="1 0 0">
                {selectedGroupedResource && (
                    <GroupedResourceOverview
                        groupedResource={selectedGroupedResource}
                    />
                )}
            </ScrollBox>
        </HStack>
    );
};

type ResourceGroupMenuProps = {
    group: GroupedResourceGroup;
    onSelectResource?: (resource: K8sResourceTypeInfo) => void;
    selectedResource?: K8sResourceTypeIdentifier | undefined;
};

const ResourceGroupMenu: React.FC<ResourceGroupMenuProps> = (props) => {
    const { group, onSelectResource, selectedResource } = props;

    const focusBoxShadow = useToken("shadows", "outline");
    const onClickResourceHandlers = useMemo(
        () =>
            group.resources.map((resource) => {
                // TODO: select the *best* version
                return () => {
                    onSelectResource?.(resource.versions[0].resource);
                };
            }),
        [group, onSelectResource]
    );

    return (
        <AccordionItem border="none">
            <AccordionButton
                ps={2}
                _focus={{}}
                _focusVisible={{
                    boxShadow: focusBoxShadow,
                }}
            >
                <Heading
                    textColor={"primary.500"}
                    fontWeight="semibold"
                    fontSize="xs"
                    textTransform="uppercase"
                >
                    {group.groupName || "Core"}
                </Heading>
            </AccordionButton>
            <AccordionPanel ps={2}>
                <VStack alignItems="stretch" spacing={0}>
                    {group.resources.map((resource, index) => (
                        <Button
                            key={resource.kindName}
                            fontSize="sm"
                            variant="link"
                            textAlign="left"
                            fontWeight="normal"
                            display="block"
                            py={0.5}
                            borderRadius={0}
                            _focus={{}}
                            _focusVisible={{
                                boxShadow: focusBoxShadow,
                            }}
                            _active={{
                                fontWeight: "bold",
                            }}
                            _hover={{
                                textDecoration: "none",
                            }}
                            onClick={onClickResourceHandlers[index]}
                            isActive={resource.versions.some(
                                (version) =>
                                    version.resource.apiVersion ===
                                        selectedResource?.apiVersion &&
                                    version.resource.kind ===
                                        selectedResource?.kind
                            )}
                            isTruncated
                        >
                            {resource.kindName}
                        </Button>
                    ))}
                </VStack>
            </AccordionPanel>
        </AccordionItem>
    );
};

type GroupedResourceOverviewProps = {
    groupedResource: GroupedResource;
};

const GroupedResourceOverview: React.FC<GroupedResourceOverviewProps> = (
    props
) => {
    const { groupedResource } = props;

    const headingColor = useColorModeValue("primary.900", "white");

    return (
        <Box>
            <Heading size="md" textColor={headingColor}>
                {groupedResource.kindName}
            </Heading>
        </Box>
    );
    return null;
};

const groupResources = (
    resources: K8sResourceTypeInfo[]
): GroupedResourceGroup[] => {
    const groupsIndex: Record<string, K8sResourceTypeInfo[]> = {};
    // First group by API group.
    for (const resource of resources) {
        let [group, version] = resource.apiVersion.split("/", 2);
        if (!version) {
            group = "";
        }
        if (!groupsIndex[group]) {
            groupsIndex[group] = [];
        }
        groupsIndex[group].push(resource);
    }
    const groups: GroupedResourceGroup[] = [];
    for (const [group, groupResources] of Object.entries(groupsIndex)) {
        const groupedResourceGroup: GroupedResourceGroup = {
            groupName: group,
            resources: [],
        };
        groups.push(groupedResourceGroup);
        const resourcesIndex: Record<string, GroupedResource> = {};
        for (const resource of groupResources) {
            let [group, version] = resource.apiVersion.split("/", 2);
            if (!version) {
                version = group;
            }
            if (!resourcesIndex[resource.kind]) {
                resourcesIndex[resource.kind] = {
                    kindName: resource.kind,
                    versions: [],
                };
                groupedResourceGroup.resources.push(
                    resourcesIndex[resource.kind]
                );
            }
            resourcesIndex[resource.kind].versions.push({
                versionName: version,
                resource,
            });
        }
    }
    return groups;
};

const sortOptions = {
    sensitivity: "base",
    numeric: true,
    ignorePunctuation: true,
};

const sortResources = (
    groupedResources: GroupedResourceGroup[]
): GroupedResourceGroup[] => {
    return [...groupedResources]
        .sort((x, y) =>
            x.groupName.localeCompare(y.groupName, undefined, sortOptions)
        )
        .map(({ groupName, resources }) => ({
            groupName,
            resources: [...resources]
                .sort((x, y) =>
                    x.kindName.localeCompare(y.kindName, undefined, sortOptions)
                )
                .map(({ kindName, versions }) => ({
                    kindName,
                    versions: sortVersions(versions),
                })),
        }));
};

function sortVersions(
    versions: GroupedResourceVersion[]
): GroupedResourceVersion[] {
    return [...versions].sort((x, y) =>
        (x.versionName + "ZZZ").localeCompare(y.versionName + "ZZZ", undefined)
    );
}
