import { ContextMenuManager } from ".";
import {
    ContextMenuOptions,
    ContextMenuTemplate,
} from "../../common/contextmenu";
import { ipcHandle } from "../../common/ipc/main";

export function wireContextMenuIpc(
    contextMenuManager: ContextMenuManager
): void {
    ipcHandle(
        "contextMenu:popup",
        ({
            menuTemplate,
            options,
        }: {
            menuTemplate: ContextMenuTemplate;
            options?: ContextMenuOptions;
        }) => contextMenuManager.popup(menuTemplate, options)
    );
}
