import React from "react";

import { RootAppUI } from "./container/app/RootAppUI";
import { AppThemeProvider } from "./container/app/AppThemeProvider";
import { AppHashParamsSyncProvider } from "./container/app/AppHashParamsSyncProvider";
import { AppEditorsSyncProvider } from "./container/app/AppEditorsSyncProvider";
import { AppActionsProvider } from "./container/app/AppActionsProvider";
import {
    AppCommand,
    AppCommandBarProvider,
} from "./container/app/AppCommandBar";

const commands: AppCommand[] = [
    // {
    //     id: "aap",
    //     text: "Aap",
    //     perform() {
    //         console.log("Aap");
    //     },
    // },
    // {
    //     id: "schaap",
    //     text: "Schaap",
    //     perform() {
    //         console.log("Schaap");
    //     },
    // },
    // {
    //     id: "blaat",
    //     text: "Blaat",
    //     perform() {
    //         console.log("Blaat");
    //     },
    // },
];

export const App: React.FunctionComponent = () => {
    return (
        <AppThemeProvider>
            <AppHashParamsSyncProvider>
                <AppEditorsSyncProvider>
                    <AppActionsProvider>
                        <AppCommandBarProvider commands={commands}>
                            <RootAppUI />
                        </AppCommandBarProvider>
                    </AppActionsProvider>
                </AppEditorsSyncProvider>
            </AppHashParamsSyncProvider>
        </AppThemeProvider>
    );
};
