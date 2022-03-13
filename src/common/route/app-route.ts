export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
    menuItem: AppMenuItem;
};

export type AppNamespacesSelection = {
    mode: "all" | "selected";
    selected: string[];
};

export type AppMenuItem = "cluster" | "resources";

export const emptyAppRoute: AppRoute = {
    context: null,
    namespaces: {
        mode: "all",
        selected: [],
    },
    menuItem: "cluster",
};
