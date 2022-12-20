import { MouseEventHandler, useCallback, useRef } from "react";
import {
    ContextMenuResult,
    ContextMenuTemplate,
} from "../../common/contextmenu";
import { useIpcCall } from "./ipc";

export type ContextMenuHookOptions = {
    onMenuAction?: (result: { actionId: string }) => void;
    onMenuClose?: (result: ContextMenuResult) => void;
};

export function useContextMenu(
    menuTemplate: ContextMenuTemplate,
    opts?: ContextMenuHookOptions
): MouseEventHandler {
    const menuIsActiveRef = useRef(false);
    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);

    const { onMenuAction, onMenuClose } = opts ?? {};

    return useCallback(
        (e) => {
            if (e.isDefaultPrevented() || menuIsActiveRef.current) {
                return;
            }

            e.preventDefault();
            menuIsActiveRef.current = true;

            popup({
                menuTemplate,
            }).then((result) => {
                onMenuClose?.(result);
                if (result.actionId) {
                    onMenuAction?.({ actionId: result.actionId });
                }
                menuIsActiveRef.current = false;
            });
        },
        [menuIsActiveRef, menuTemplate, onMenuAction, onMenuClose]
    );
}
