export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
    params: Record<string, unknown>;
    activeEditor: AppEditor | null;
};

export type AppNamespacesSelection = {
    mode: "all" | "selected";
    selected: string[];
};

export type AppEditor =
    | {
          id: string;
          type: "resource";
          apiVersion: string;
          kind: string;
          name: string;
          namespace?: string | undefined;
      }
    | {
          id: string;
          type: "new-resource";
          name: string;
          apiVersion?: string;
          kind?: string;
      };

export const emptyAppRoute: AppRoute = {
    context: null,
    namespaces: {
        mode: "all",
        selected: [],
    },
    params: {},
    activeEditor: null,
};
