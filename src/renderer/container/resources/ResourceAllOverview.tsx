import {
    Accordion,
    AccordionButton,
    AccordionItem,
    AccordionPanel,
    Box,
    Heading,
    HStack,
    Link,
    VStack,
} from "@chakra-ui/react";
import React, { useMemo } from "react";
import { K8sResourceTypeInfo } from "../../../common/k8s/client";
import { ScrollBox } from "../../component/main/ScrollBox";
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

    return (
        <HStack flex="1 0 0" overflow="hidden" spacing={0} alignItems="stretch">
            <ScrollBox px={2} py={2} flex="0 0 250px">
                <Accordion allowToggle>
                    {sortedResources?.map((group) => (
                        <ResourceGroupMenu
                            key={group.groupName}
                            group={group}
                        />
                    ))}
                </Accordion>
            </ScrollBox>
            <ScrollBox px={4} py={2} flex="1 0 0">
                {resources?.map((resource) => (
                    <Box key={resource.apiVersion + " " + resource.kind}>
                        {resource.apiVersion + " " + resource.kind}
                    </Box>
                ))}
            </ScrollBox>
        </HStack>
    );
};

const ResourceGroupMenu: React.FC<{ group: GroupedResourceGroup }> = (
    props
) => {
    const { group } = props;
    return (
        <AccordionItem>
            <AccordionButton ps={2}>
                <Heading
                    textColor={"primary.500"}
                    fontWeight="semibold"
                    fontSize="xs"
                    textTransform="uppercase"
                >
                    {group.groupName || "Common"}
                </Heading>
            </AccordionButton>
            <AccordionPanel ps={2}>
                <VStack alignItems="stretch" spacing={0}>
                    {group.resources.map((resource) => (
                        <ResourceMenu
                            key={resource.kindName}
                            resource={resource}
                        />
                    ))}
                </VStack>
            </AccordionPanel>
        </AccordionItem>
    );
};

const ResourceMenu: React.FC<{ resource: GroupedResource }> = (props) => {
    const { resource } = props;
    return (
        <Link fontSize="sm" tabIndex={0} isTruncated>
            {resource.kindName}
        </Link>
    );
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
                    versions: [...versions].sort((x, y) =>
                        x.versionName.localeCompare(
                            y.versionName,
                            undefined,
                            sortOptions
                        )
                    ),
                })),
        }));
};
