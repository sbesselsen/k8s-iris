import {
    Button,
    Heading,
    Icon,
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
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { MdCheckCircle, MdClose } from "react-icons/md";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { groupByKeys } from "../../common/util/group";
import { searchMatch } from "../../common/util/search";
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

    const [searchValue, setSearchValue] = useState("");

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

    // Listen for Cmd + T.
    // TODO: probably best to put this somewhere else
    useEffect(() => {
        const listener: any = (e: KeyboardEvent) => {
            if (e.key === "t" && e.getModifierState("Meta")) {
                onOpen();
            }
        };
        window.addEventListener("keydown", listener);
        return () => {
            window.removeEventListener("keydown", listener);
        };
    }, [onOpen]);

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

    const groupedContexts = useMemo(
        () =>
            groupByKeys(
                contextsWithCloudInfo,
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
        [contextsWithCloudInfo]
    );

    const filteredGroupedContexts = useMemo(
        () =>
            groupedContexts
                .map(
                    ([group, contexts]) =>
                        [
                            group,
                            contexts.filter((context) =>
                                searchMatch(
                                    searchValue,
                                    [
                                        context.name,
                                        context.cloudProvider,
                                        context.cloudService,
                                        context.region,
                                        context.bestAccountId,
                                        context.bestAccountName,
                                        context.localClusterName,
                                    ]
                                        .filter((x) => x)
                                        .join(" ")
                                )
                            ),
                        ] as [
                            Partial<ContextWithCloudInfo>,
                            ContextWithCloudInfo[]
                        ]
                )
                .filter(([_, contexts]) => contexts.length > 0),
        [groupedContexts, searchValue]
    );

    const selectedContextWithCloudInfo = contextsWithCloudInfo.find(
        (context) => context.name === kubeContext
    );

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
            if (e.key === "Enter") {
                const filteredContexts = filteredGroupedContexts.flatMap(
                    ([_, contexts]) => contexts
                );
                if (filteredContexts.length === 1) {
                    // On press enter, if we have only one result, select it.
                    onSelectContext(
                        filteredContexts[0].name,
                        e.getModifierState("Meta")
                    );
                }
            }
        },
        [filteredGroupedContexts, onSelectContext, setSearchValue]
    );

    const clearSearch = useCallback(() => {
        setSearchValue("");
        searchBoxRef.current?.focus();
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
                        <InputGroup marginBottom={4}>
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
                        <VStack spacing={4} width="100%" alignItems="start">
                            {filteredGroupedContexts.map(
                                ([group, contexts]) => (
                                    <>
                                        <VStack
                                            spacing={1}
                                            width="100%"
                                            alignItems="start"
                                        >
                                            <K8sContextSelectorGroupHeading
                                                group={group}
                                            />
                                            {contexts.map((context) => (
                                                <K8sContextSelectorItem
                                                    key={context.name}
                                                    isSelected={
                                                        kubeContext ===
                                                        context.name
                                                    }
                                                    contextWithCloudInfo={
                                                        context
                                                    }
                                                    onClick={onSelectContext}
                                                />
                                            ))}
                                        </VStack>
                                    </>
                                )
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
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
            width="100%"
            justifyContent="start"
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
