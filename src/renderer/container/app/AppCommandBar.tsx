import {
    Box,
    Button,
    Input,
    Portal,
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

export type AppCommandSource = AppCommand[] | AppCommandSourceFunction;

export type AppCommandSourceFunction = (
    search: string,
    parentId: string | null
) => Promise<AppCommand[]>;

export type AppCommand = {
    id: string;
    text: string;
    detailText?: string;
    perform: () => void;
    parentId?: string;
    parentText?: string;
    icon?: ReactNode;
    searchText?: string;
};

type AppCommandBarData = {
    sources: AppCommandSourceFunction[];
    isVisible: boolean;
    search: string;
    parentCommandId?: string;
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

export function useAppCommands(commands: AppCommandSource) {
    useOptionalAppCommands(commands);
}

function useOptionalAppCommands(commands: AppCommandSource | null | undefined) {
    const store = useStore();

    useEffect(() => {
        const normalizedSource = commands
            ? commandSourceFunction(commands)
            : null;
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

    const [availableCommands, setAvailableCommands] = useState<AppCommand[]>(
        []
    );

    const [selectedId, setSelectedId] = useState<string | null>(null);

    // TODO: accessibility through aria- attributes.

    const onClick = useMemo(() => {
        return Object.fromEntries(
            availableCommands.map((c) => [
                c.id,
                () => {
                    store.set((v) => ({ ...v, search: "", isVisible: false }));
                    setTimeout(() => {
                        c.perform();
                    }, 0);
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
        let prevSearch = "";
        let prevSources: AppCommandSourceFunction[] = [];
        const listener = async (v: AppCommandBarData) => {
            const { search, sources } = v;
            if (search === prevSearch && sources === prevSources) {
                // Nothing new to search.
                return;
            }
            prevSearch = search;
            prevSources = sources;

            const foundCommands = await findCommands(v);
            const {
                search: newSearch,
                sources: newSources,
                isVisible,
            } = store.get();
            if (newSearch !== search || newSources !== sources || !isVisible) {
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
                                sx={{ _hover: {} }}
                            >
                                <VStack
                                    w="100%"
                                    h="auto"
                                    alignItems="stretch"
                                    textAlign="start"
                                    spacing={0}
                                >
                                    <Box>{c.text}</Box>
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

function commandSourceFunction(
    commands: AppCommandSource
): AppCommandSourceFunction {
    return typeof commands === "function" ? commands : async () => commands;
}

async function findCommands(data: AppCommandBarData): Promise<AppCommand[]> {
    const promises = data.sources.map((f) =>
        f(data.search, data.parentCommandId ?? null)
    );
    const commands = (await Promise.all(promises)).flatMap((c) => c);

    // Get only commands under the current parent if a parent has been selected.
    const commandsUnderParent = data.parentCommandId
        ? commands.filter((c) => c.parentId === data.parentCommandId)
        : commands;

    const commandMatcher = createCommandMatcher(data.search);

    // Now post-filter and sort the commands.
    const commandsWithScores = commandsUnderParent.map((command) => ({
        command,
        score: commandMatcher(command),
    }));

    // Filter only commands with non-zero score.
    const filteredCommandsWithScores = commandsWithScores.filter(
        ({ score }) => score > 0
    );

    // Sort commands by score (descending).
    const sortedCommandsWithScores = filteredCommandsWithScores.sort(
        (a, b) => b.score - a.score
    );

    return sortedCommandsWithScores.map(({ command }) => command);
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
            command.parentText ?? "",
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
