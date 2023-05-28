import { useCallback } from "react";
import { emptyAppRoute } from "../../common/route/app-route";
import { useAppEditorsStore } from "../context/editors";
import { useAppRouteGetter, useAppRouteSetter } from "../context/route";
import { useDialog } from "./dialog";
import { useIpcCall } from "./ipc";
import { usePersistentState } from "./persistent-state";

export function useOpenContext(): (
    context: string,
    requestNewWindow?: boolean
) => void {
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const editorsStore = useAppEditorsStore();

    const showDialog = useDialog();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const [, , setAppCurrentContext] = usePersistentState("currentContext");

    return useCallback(
        async (context: string, requestNewWindow = false) => {
            function openInNewWindow() {
                setAppCurrentContext(context);

                createWindow({
                    route: {
                        ...emptyAppRoute,
                        context,
                    },
                });
            }

            function open() {
                setAppCurrentContext(context);

                setAppRoute(() => ({
                    ...emptyAppRoute,
                    context,
                }));
            }

            if (requestNewWindow) {
                openInNewWindow();
                return;
            }
            if (context === getAppRoute().context) {
                // Do not switch at all if the context remains the same.
                return;
            }
            const numEditors = editorsStore.get().length;
            if (numEditors === 0) {
                open();
                return;
            }
            const result = await showDialog({
                title: "Are you sure?",
                type: "question",
                message: `You have ${numEditors} editor${
                    numEditors > 1 ? "s" : ""
                } open.`,
                detail: `Switching context will close all open editors and you will lose your changes.`,
                buttons: [
                    "Open in New Window",
                    "Close Editors and Switch",
                    "Cancel",
                ],
                defaultId: 0,
            });
            switch (result.response) {
                case 0:
                    openInNewWindow();
                    break;
                case 1:
                    open();
                    break;
            }
        },
        [
            createWindow,
            editorsStore,
            getAppRoute,
            setAppRoute,
            setAppCurrentContext,
            showDialog,
        ]
    );
}
