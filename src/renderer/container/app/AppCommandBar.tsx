import {
    Box,
    Button,
    HStack,
    IconButton,
    Input,
    Portal,
    Text,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    PropsWithChildren,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import escapeStringRegexp from "escape-string-regexp";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { create } from "../../util/state";
import { ArrowLeftIcon } from "@chakra-ui/icons";

export type AppCommandSource = {
    fetchCommand(id: string): Promise<AppCommand | null>;
    searchCommands(
        search: string,
        parentCommandId: string | null
    ): Promise<AppCommand[]>;
};

export type AppCommand = {
    id: string;
    text: string;
    detailText?: string;
    perform: () => void;
    parentId?: string;
    icon?: ReactNode;
    searchText?: string;
};

type AugmentedAppCommand = AppCommand & {
    isParent: boolean;
    parent?: AppCommand;
};

type AppCommandBarData = {
    sources: AppCommandSource[];
    isVisible: boolean;
    search: string;
    parentCommandId?: string;
    breadcrumbCommandIds?: string[];
};

const { useStore, useStoreValue } = create<AppCommandBarData>({
    isVisible: false,
    sources: [],
    search: "",
});

export type AppCommandBarController = {
    toggle(visible?: boolean): void;
};

export function useAppCommandBar(): AppCommandBarController {
    const store = useStore();
    return useMemo(
        () => ({
            toggle(visible = true) {
                store.set((v) => ({
                    ...v,
                    isVisible: visible,
                }));
            },
        }),
        [store]
    );
}

export function useAppCommands(commands: AppCommandSource | AppCommand[]) {
    useOptionalAppCommands(commands);
}

function useOptionalAppCommands(
    commands: AppCommandSource | AppCommand[] | null | undefined
) {
    const store = useStore();

    useEffect(() => {
        const normalizedSource = commands ? commandSource(commands) : null;
        if (normalizedSource) {
            // Add command source.
            store.set((v) => ({
                ...v,
                sources: [...v.sources, normalizedSource],
            }));
        }
        return () => {
            if (normalizedSource) {
                // Remove command source.
                store.set((v) => ({
                    ...v,
                    sources: v.sources.filter((s) => s !== normalizedSource),
                }));
            }
        };
    }, [commands, store]);
}

export const AppCommandBarProvider: React.FC<
    PropsWithChildren<{ commands?: AppCommandSource }>
> = (props) => {
    const { children, commands } = props;

    useOptionalAppCommands(commands);

    return (
        <>
            <Portal>
                <AppCommandBarContainer>
                    <AppCommandBar />
                </AppCommandBarContainer>
            </Portal>
            {children}
        </>
    );
};

const AppCommandBarContainer: React.FC<PropsWithChildren> = ({ children }) => {
    const store = useStore();
    const metaKeyRef = useModifierKeyRef("Meta");
    const isVisible = useStoreValue((v) => v.isVisible);

    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (
                    eventType === "keydown" &&
                    key === "Escape" &&
                    store.get().isVisible
                ) {
                    store.set((v) => {
                        if (v.search) {
                            return { ...v, search: "" };
                        }
                        if (v.parentCommandId) {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { parentCommandId, ...newV } = v;
                            if (
                                v.breadcrumbCommandIds &&
                                v.breadcrumbCommandIds.length > 0
                            ) {
                                const breadcrumbCommandIds = [
                                    ...v.breadcrumbCommandIds,
                                ];
                                (newV as AppCommandBarData).parentCommandId =
                                    breadcrumbCommandIds.pop();
                                if (breadcrumbCommandIds.length > 0) {
                                    newV.breadcrumbCommandIds =
                                        breadcrumbCommandIds;
                                } else {
                                    delete newV.breadcrumbCommandIds;
                                }
                            }
                            return newV;
                        }
                        return { ...v, isVisible: false };
                    });
                } else if (
                    metaKeyRef.current &&
                    eventType === "keydown" &&
                    key === "k" &&
                    !store.get().isVisible
                ) {
                    if (store.get().sources.length === 0) {
                        console.warn(
                            "No command sources provided for AppCommandBar"
                        );
                        return;
                    }
                    store.set((v) => ({ ...v, isVisible: true }));
                }
            },
            [metaKeyRef, store]
        )
    );

    return isVisible ? <>{children}</> : null;
};

const AppCommandBar: React.FC = () => {
    const store = useStore();
    const onClickBackground = useCallback(() => {
        store.set((v) => ({ ...v, isVisible: false }));
    }, [store]);

    const bg = useColorModeValue("white", "gray.700");
    const inputBg = useColorModeValue("gray.50", "gray.800");

    const [availableCommands, setAvailableCommands] = useState<
        AugmentedAppCommand[]
    >([]);
    const [[, parentCommand], setParentCommand] = useState<
        [boolean, AppCommand | undefined]
    >([true, undefined]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // TODO: accessibility through aria- attributes.

    const onClick = useMemo(() => {
        return Object.fromEntries(
            availableCommands.map((c) => [
                c.id,
                () => {
                    if (c.isParent) {
                        store.set((v) => {
                            const newV: AppCommandBarData = {
                                ...v,
                                search: "",
                                parentCommandId: c.id,
                            };
                            if (v.parentCommandId) {
                                // Add to the breadcrumb.
                                newV.breadcrumbCommandIds = [
                                    ...(v.breadcrumbCommandIds ?? []),
                                    v.parentCommandId,
                                ];
                            }
                            return newV;
                        });
                    } else {
                        store.set((v) => ({
                            ...v,
                            parentCommandId: undefined,
                            search: "",
                            isVisible: false,
                        }));
                        setTimeout(() => {
                            c.perform();
                        }, 0);
                    }
                },
            ])
        );
    }, [availableCommands, store]);

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                // Move selection focus.
                if (availableCommands.length === 0) {
                    setSelectedId(null);
                    return;
                }
                const selectedIndex = selectedId
                    ? availableCommands.findIndex((c) => c.id === selectedId)
                    : -1;
                let newIndex = selectedIndex;
                if (e.key === "ArrowDown") {
                    // Down.
                    newIndex =
                        selectedIndex === availableCommands.length - 1
                            ? 0
                            : selectedIndex + 1;
                } else {
                    // Up.
                    newIndex =
                        selectedIndex <= 0
                            ? availableCommands.length - 1
                            : selectedIndex - 1;
                }
                const newId = availableCommands[newIndex].id;
                setSelectedId(newId);
                e.preventDefault();
            }
            if (e.key === "Enter") {
                if (selectedId) {
                    onClick[selectedId]?.();
                } else if (availableCommands.length === 1) {
                    onClick[availableCommands[0].id]();
                }
            }
        },
        [availableCommands, onClick, selectedId, setSelectedId]
    );

    useEffect(() => {
        let prevSearch: string | undefined = undefined;
        let prevSources: AppCommandSource[] = [];
        let prevParentCommandId: string | undefined = undefined;
        const listener = async (v: AppCommandBarData) => {
            const { parentCommandId, search, sources } = v;
            if (
                parentCommandId === prevParentCommandId &&
                search === prevSearch &&
                sources === prevSources
            ) {
                // Nothing new to search.
                return;
            }
            prevParentCommandId = parentCommandId;
            prevSearch = search;
            prevSources = sources;

            const foundCommands = await findCommands(v);
            const {
                parentCommandId: newParentCommandId,
                search: newSearch,
                sources: newSources,
                isVisible,
            } = store.get();
            if (
                newParentCommandId !== parentCommandId ||
                newSearch !== search ||
                newSources !== sources ||
                !isVisible
            ) {
                // Cancel these results because they are outdated.
                return;
            }
            setAvailableCommands(foundCommands);
            setSelectedId(null);
        };
        listener(store.get());
        store.subscribe(listener);
        return () => {
            store.unsubscribe(listener);
        };
    }, [setAvailableCommands, setSelectedId, store]);

    const parentCommandId = useStoreValue((v) => v.parentCommandId);
    useEffect(() => {
        let isStopped = false;

        if (!parentCommandId) {
            setParentCommand([false, undefined]);
            return;
        }

        // Load parent command.
        setParentCommand([true, undefined]);
        (async () => {
            const commands = (
                await Promise.all(
                    store
                        .get()
                        .sources.map((s) => s.fetchCommand(parentCommandId))
                )
            ).filter((c) => c) as AppCommand[];
            if (!isStopped) {
                setParentCommand([false, commands[0] ?? undefined]);
            }
        })();
        return () => {
            isStopped = true;
        };
    }, [parentCommandId, store, setParentCommand]);

    const search = useStoreValue((v) => v.search);
    const onChangeSearch = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            store.set((v) => ({ ...v, search: e.target.value }));
        },
        [store]
    );

    const buttonTextColor = useColorModeValue("black", "white");
    const mutedColor = useColorModeValue("gray.600", "gray.400");

    const onClickBar = useCallback((e: MouseEvent) => {
        e.stopPropagation();
    }, []);

    const onClickBack = useCallback(() => {
        store.set((v) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { parentCommandId, ...newV } = v;
            if (v.breadcrumbCommandIds && v.breadcrumbCommandIds.length > 0) {
                const breadcrumbCommandIds = [...v.breadcrumbCommandIds];
                (newV as AppCommandBarData).parentCommandId =
                    breadcrumbCommandIds.pop();
                if (breadcrumbCommandIds.length > 0) {
                    newV.breadcrumbCommandIds = breadcrumbCommandIds;
                } else {
                    delete newV.breadcrumbCommandIds;
                }
            }
            return newV;
        });
    }, [store]);

    return (
        <VStack
            position="fixed"
            left="0"
            right="0"
            top="0"
            bottom="0"
            zIndex="1000"
            pt="20px"
            alignItems="center"
            onClick={onClickBackground}
        >
            <VStack
                borderRadius={8}
                overflow="hidden"
                boxShadow="dark-lg"
                alignItems="stretch"
                spacing={0}
                bg={bg}
                w="400px"
                maxWidth="100%"
                maxHeight="calc(100vh - 40px)"
                onClick={onClickBar}
            >
                <Box p={2}>
                    <Input
                        bg={inputBg}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        autoFocus
                        size="lg"
                        flex="0 0 auto"
                        placeholder="Enter a command"
                        value={search}
                        onInput={onChangeSearch}
                        onKeyDown={onKeyDown}
                    />
                </Box>
                {parentCommandId && (
                    <HStack px={2} py={2} fontWeight="bold" fontSize="md">
                        <IconButton
                            icon={<ArrowLeftIcon />}
                            aria-label="Back"
                            onClick={onClickBack}
                            variant="ghost"
                            colorScheme="gray"
                            size="sm"
                        />
                        <Text>{parentCommand?.text ?? parentCommandId}:</Text>
                    </HStack>
                )}
                {availableCommands.length > 0 && (
                    <VStack
                        flex="1 1 100%"
                        alignItems="stretch"
                        overflowY="scroll"
                        spacing={0}
                    >
                        {availableCommands.map((c) => (
                            <Button
                                size="sm"
                                flex="0 0 40px"
                                key={c.id}
                                isActive={selectedId === c.id}
                                justifyContent="start"
                                variant="ghost"
                                fontWeight="normal"
                                textColor={buttonTextColor}
                                borderRadius={0}
                                onClick={onClick[c.id]}
                            >
                                <VStack
                                    w="100%"
                                    h="auto"
                                    alignItems="stretch"
                                    textAlign="start"
                                    spacing={0}
                                >
                                    <Box>
                                        {!parentCommand && c.parent
                                            ? `${c.parent.text} `
                                            : ""}
                                        {c.text}
                                        {c.isParent && "..."}
                                    </Box>
                                    {c.detailText && (
                                        <Box
                                            textColor={mutedColor}
                                            fontSize="xs"
                                        >
                                            {c.detailText}
                                        </Box>
                                    )}
                                </VStack>
                            </Button>
                        ))}
                    </VStack>
                )}
            </VStack>
        </VStack>
    );
};

function commandSource(
    commands: AppCommandSource | AppCommand[]
): AppCommandSource {
    if (!Array.isArray(commands)) {
        return commands;
    }
    const commandsById = Object.fromEntries(commands.map((c) => [c.id, c]));
    return {
        async fetchCommand(id) {
            return commandsById[id] ?? null;
        },
        async searchCommands() {
            return commands;
        },
    };
}

async function findCommands(
    data: AppCommandBarData
): Promise<AugmentedAppCommand[]> {
    const promises = data.sources.map((s) =>
        s.searchCommands(data.search, data.parentCommandId ?? null)
    );
    const commands = (await Promise.all(promises)).flatMap((c) => c);

    const commandsById = Object.fromEntries(commands.map((c) => [c.id, c]));

    // Add parent text to all commands.
    const commandsWithParents = commands.map((c) => ({
        ...c,
        parent: c.parentId ? commandsById[c.parentId] : undefined,
    }));

    // Get only commands under the current parent if a parent has been selected.
    const commandsUnderParent = data.parentCommandId
        ? commandsWithParents.filter((c) => c.parentId === data.parentCommandId)
        : commandsWithParents;

    const commandMatcher = createCommandMatcher(data.search);

    // Now post-filter and sort the commands.
    const commandsWithScores = commandsUnderParent.map((command) => ({
        command,
        score: data.search ? commandMatcher(command) : 1,
    }));

    // Filter commands with non-zero score.
    const filteredCommandsWithScores = commandsWithScores.filter(
        ({ score }) => score > 0
    );

    const filteredIds = new Set<string>([
        ...(filteredCommandsWithScores
            .map(({ command }) => command.id)
            .filter((c) => c) as string[]),
    ]);

    const filteredParentIds = new Set<string>([
        ...(filteredCommandsWithScores
            .map(({ command }) => command.parentId)
            .filter((c) => c) as string[]),
    ]);

    // Remove all items whose parent was also found (because in that case we are simply looking for the parent).
    const combineToParentsCommandsWithScores =
        filteredCommandsWithScores.filter(
            ({ command }) =>
                !command.parentId || !filteredIds.has(command.parentId)
        );

    // Sort commands by score (descending).
    const sortedCommandsWithScores = combineToParentsCommandsWithScores.sort(
        (a, b) => b.score - a.score
    );

    return sortedCommandsWithScores.map(({ command }) => ({
        ...command,
        isParent: filteredParentIds.has(command.id),
    }));
}

export function createCommandMatcher(
    search: string
): (command: AppCommand) => number {
    const terms = search.split(/\s+/).filter((x) => x);
    if (terms.length === 0) {
        return () => 0;
    }

    const regexes = terms.map((term) => {
        const characters = [...term];
        const regexStr = characters
            .map(escapeStringRegexp)
            .join("[\\s\\S]{0,5}?");
        return new RegExp(regexStr, "ig");
    });

    return (command) => {
        const searchText = [
            (command as AugmentedAppCommand).parent?.text ?? "",
            command.text,
            command.detailText ?? "",
            command.searchText ?? "",
        ]
            .filter((x) => x)
            .join(" ");

        const scores = regexes.map((regex) => {
            const matches = [...searchText.matchAll(regex)];
            if (matches.length === 0) {
                return 0;
            }
            const score = Math.max(
                ...matches.map((match) => {
                    let score = 1;
                    const totalMatchLength = match[0].length;
                    const extraneousMatchLength =
                        totalMatchLength - search.length;
                    if (extraneousMatchLength > 0) {
                        score /= Math.sqrt(extraneousMatchLength + 1);
                    }
                    return score;
                })
            );
            return score;
        });
        if (Math.min(...scores) === 0) {
            return 0;
        }
        return scores.reduce((x, y) => x + y, 0);
    };
}

export function matchCommand(command: AppCommand, search: string): number {
    return createCommandMatcher(search)(command);
}
