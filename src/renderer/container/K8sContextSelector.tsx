import {
    Button,
    Heading,
    Icon,
    IconButton,
    Input,
    InputGroup,
    InputRightElement,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    useDisclosure,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    KeyboardEvent,
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react";
import { MdCheckCircle, MdClose } from "react-icons/md";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { groupByKeys } from "../../common/util/group";
import { k8sSmartCompare } from "../../common/util/sort";
import { useK8sContext, useK8sContextStore } from "../context/k8s-context";
import { useAsync } from "../hook/async";
import { useIpc } from "../hook/ipc";

type ContextWithCloudInfo = K8sContext &
    Partial<CloudK8sContextInfo> & {
        bestAccountId?: string;
        bestAccountName?: string;
    };

export const K8sContextSelector: React.FC = () => {
    const kubeContext = useK8sContext();
    const kubeContextStore = useK8sContextStore();

    const ipc = useIpc();

    const [_loadingContexts, contexts] = useAsync(
        () => ipc.k8s.listContexts(),
        []
    );
    const [_loadingCloudInfo, cloudInfo] = useAsync(
        async () => (contexts ? ipc.cloud.augmentK8sContexts(contexts) : {}),
        [contexts]
    );

    const { isOpen, onOpen, onClose } = useDisclosure();

    const onSelectContext = useCallback(
        (context: string, requestNewWindow: boolean) => {
            if (requestNewWindow) {
                ipc.app.createWindow({ context });
            } else {
                kubeContextStore.set(context);
                onClose();
            }
        },
        [ipc]
    );

    const contextsWithCloudInfo: ContextWithCloudInfo[] = useMemo(
        () =>
            contexts?.map((context) => ({
                ...context,
                ...(cloudInfo?.[context.name] ?? null),
                bestAccountId:
                    cloudInfo?.[context.name]?.accounts?.[0].accountId,
                bestAccountName:
                    cloudInfo?.[context.name]?.accounts?.[0].accountName,
            })) ?? [],
        [contexts, cloudInfo]
    );

    const selectedContextWithCloudInfo = contextsWithCloudInfo.find(
        (context) => context.name === kubeContext
    );

    const [searchValue, setSearchValue] = useState("");

    const searchBoxRef = useRef<HTMLInputElement>();

    const onSearchChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(e.target.value);
        },
        [setSearchValue]
    );

    const onSearchKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Escape" && e.currentTarget.value) {
                setSearchValue("");
                e.stopPropagation();
            }
        },
        [setSearchValue]
    );

    const clearSearch = useCallback(() => {
        setSearchValue("");
    }, [setSearchValue]);

    return (
        <>
            <Button onClick={onOpen}>
                {selectedContextWithCloudInfo?.localClusterName ?? kubeContext}
            </Button>

            <Modal
                onClose={onClose}
                isOpen={isOpen || !kubeContext}
                initialFocusRef={searchBoxRef}
            >
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Select context</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <InputGroup>
                            <Input
                                placeholder="Search"
                                ref={searchBoxRef}
                                value={searchValue}
                                onChange={onSearchChange}
                                onKeyDown={onSearchKeyDown}
                            />
                            <InputRightElement>
                                {searchValue && (
                                    <Icon
                                        aria-label="clear search box"
                                        onClick={clearSearch}
                                        as={MdClose}
                                        color="gray.500"
                                    />
                                )}
                            </InputRightElement>
                        </InputGroup>
                        <K8sContextSelectorList
                            selectedContext={kubeContext}
                            onSelectContext={onSelectContext}
                            searchValue={searchValue}
                            contextsWithCloudInfo={contextsWithCloudInfo ?? []}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

const K8sContextSelectorList: React.FC<{
    contextsWithCloudInfo: ContextWithCloudInfo[];
    onSelectContext: (context: string, requestNewWindow: boolean) => void;
    searchValue: string;
    selectedContext: string;
}> = (props) => {
    const {
        contextsWithCloudInfo,
        onSelectContext,
        searchValue,
        selectedContext,
    } = props;

    // TODO: filter after grouping
    // TODO: filter smarter (otx => ota-taxvice etc.)
    const filteredContexts = useMemo(
        () =>
            contextsWithCloudInfo.filter((context) => {
                return (
                    (context?.localClusterName ?? context.name)
                        .toLocaleLowerCase()
                        .indexOf(searchValue.toLocaleLowerCase()) !== -1
                );
            }),
        [contextsWithCloudInfo, searchValue]
    );

    const groupedContexts = useMemo(
        () =>
            groupByKeys(
                filteredContexts,
                [
                    "cloudProvider",
                    "cloudService",
                    "bestAccountName",
                    "bestAccountId",
                    "region",
                ],
                (_, a, b) => k8sSmartCompare(a, b)
            ).map(
                ([group, contexts]) =>
                    [
                        group,
                        contexts.sort((a, b) =>
                            k8sSmartCompare(
                                a.localClusterName ?? a.name,
                                b.localClusterName ?? b.name
                            )
                        ),
                    ] as [Partial<CloudK8sContextInfo>, ContextWithCloudInfo[]]
            ),
        [filteredContexts]
    );

    return (
        <VStack spacing={4} width="100%" alignItems="start">
            {groupedContexts.map(([group, contexts]) => (
                <>
                    <VStack spacing={1} alignItems="start">
                        <K8sContextSelectorGroupHeading group={group} />
                        {contexts.map((context) => (
                            <K8sContextSelectorItem
                                key={context.name}
                                isSelected={selectedContext === context.name}
                                contextWithCloudInfo={context}
                                onClick={onSelectContext}
                            />
                        ))}
                    </VStack>
                </>
            ))}
        </VStack>
    );
};

const K8sContextSelectorGroupHeading: React.FC<{
    group: Partial<ContextWithCloudInfo>;
}> = (props) => {
    const { group } = props;
    if (Object.keys(group).length === 0) {
        // This group has no identity of its own.
        return null;
    }

    const headingParts: string[] = [
        group.cloudProvider,
        group.cloudService,
        group.bestAccountName ?? group.bestAccountId,
        group.region,
    ].filter((x) => x);
    return (
        <Heading
            color="gray.500"
            letterSpacing="wide"
            textTransform="uppercase"
            size="xs"
            fontSize="xs"
            isTruncated
        >
            {headingParts.join(" • ")}
        </Heading>
    );
};

const K8sContextSelectorItem: React.FC<{
    isSelected: boolean;
    contextWithCloudInfo: ContextWithCloudInfo;
    onClick?: (name: string, requestNewWindow: boolean) => void;
}> = (props) => {
    const { contextWithCloudInfo: context, isSelected, onClick } = props;

    const onButtonClick = useCallback(
        (e: React.MouseEvent) => {
            onClick(context.name, e.getModifierState("Meta"));
        },
        [context, onClick]
    );

    const localName = context.localClusterName ?? context.name;

    return (
        <Button
            onClick={onButtonClick}
            variant="link"
            fontWeight="normal"
            textColor="gray.800"
            py={1}
            leftIcon={
                isSelected ? (
                    <Icon as={MdCheckCircle} color="green.500" />
                ) : null
            }
        >
            {localName}
        </Button>
    );
};
