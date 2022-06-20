export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
    menuItem: string | null;
    isSidebarVisible: boolean;
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
          type: "pod-shell";
          name: string;
          containerName: string;
          namespace: string;
      }
    | {
          id: string;
          type: "pod-logs";
          name: string;
          containerName: string;
          namespace: string;
      }
    | {
          id: string;
          type: "new-resource";
          name: string;
          apiVersion?: string;
          kind?: string;
      }
    | {
          id: string;
          type: "local-shell";
          name: string;
      };

export const emptyAppRoute: AppRoute = {
    context: null,
    namespaces: {
        mode: "all",
        selected: [],
    },
    menuItem: null,
    isSidebarVisible: true,
    params: {},
    activeEditor: null,
};
