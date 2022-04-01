export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
    params: Record<string, unknown>;
    editors: AppEditors;
};

export type AppNamespacesSelection = {
    mode: "all" | "selected";
    selected: string[];
};

export type AppEditors = {
    items?: AppEditor[];
    selected?: string | undefined;
};

export type AppEditor = {
    id: string;
    type: "resource";
    apiVersion: string;
    kind: string;
    name: string;
    namespace?: string | undefined;
};

export const emptyAppRoute: AppRoute = {
    context: null,
    namespaces: {
        mode: "all",
        selected: [],
    },
    params: {},
    editors: {},
};
