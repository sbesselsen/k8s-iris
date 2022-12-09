import { MenuItemConstructorOptions } from "electron/common";

export type ContextMenuTemplate<T = ContextMenuItemConstructorOptions> =
    Array<T>;

export type ContextMenuItemConstructorOptions = Omit<
    MenuItemConstructorOptions,
    "click" | "submenu" | "icon"
> & {
    actionId?: string;
    submenu?: ContextMenuTemplate;
};

export type ContextMenuOptions = {
    position?: { x: number; y: number };
};

export type ContextMenuResult = {
    actionId?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
};
