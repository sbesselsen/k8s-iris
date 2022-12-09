import { MenuItemConstructorOptions } from "electron";
import { Menu } from "electron/main";
import {
    ContextMenuItemConstructorOptions,
    ContextMenuOptions,
    ContextMenuResult,
    ContextMenuTemplate,
} from "../../common/contextmenu";

export type ContextMenuManager = {
    popup: (
        menuTemplate: ContextMenuTemplate,
        options?: ContextMenuOptions
    ) => Promise<ContextMenuResult>;
};

export function createContextMenuManager(): ContextMenuManager {
    return {
        async popup(menuTemplate, options?) {
            const [processedMenuTemplate, actionPromise] =
                hookupActions(menuTemplate);
            const menu = Menu.buildFromTemplate(processedMenuTemplate);
            return new Promise((resolve) => {
                actionPromise.then((result) => {
                    resolve(result);
                });
                menu.popup({
                    ...(options?.position
                        ? {
                              x: options.position.x,
                              y: options.position.y,
                          }
                        : {}),
                    callback: () => {
                        resolve({});
                    },
                });
            });
        },
    };
}

function hookupActions(
    menuTemplate: ContextMenuTemplate
): [
    Array<MenuItemConstructorOptions>,
    Promise<ContextMenuResult & { actionId: string }>
] {
    let processedTemplate: Array<MenuItemConstructorOptions> = [];
    const actionPromise = new Promise<ContextMenuResult & { actionId: string }>(
        (resolve) => {
            function processItem(
                item: ContextMenuItemConstructorOptions
            ): MenuItemConstructorOptions {
                const processedItem: MenuItemConstructorOptions = { ...item };
                const { actionId, submenu } = item;
                if (actionId) {
                    processedItem.click = (_item, _window, e) => {
                        const { ctrlKey, metaKey, shiftKey, altKey } = e;
                        resolve({
                            actionId,
                            ctrlKey,
                            metaKey,
                            shiftKey,
                            altKey,
                        });
                    };
                }
                if (submenu) {
                    processedItem.submenu = item.submenu?.map(processItem);
                }
                return processedItem;
            }

            processedTemplate = menuTemplate.map(processItem);
        }
    );

    return [processedTemplate, actionPromise];
}
