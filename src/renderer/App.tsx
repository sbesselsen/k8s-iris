import React from "react";

import { RootAppUI } from "./container/app/RootAppUI";
import { AppThemeProvider } from "./container/app/AppThemeProvider";
import { AppHashParamsSyncProvider } from "./container/app/AppHashParamsSyncProvider";
import { AppEditorsSyncProvider } from "./container/app/AppEditorsSyncProvider";
import { AppActionsProvider } from "./container/app/AppActionsProvider";
import { AppCommandBarProvider } from "./container/app/AppCommandBar";

export const App: React.FunctionComponent = () => {
    return (
        <AppHashParamsSyncProvider>
            <AppThemeProvider>
                <AppEditorsSyncProvider>
                    <AppActionsProvider>
                        <AppCommandBarProvider>
                            <RootAppUI />
                        </AppCommandBarProvider>
                    </AppActionsProvider>
                </AppEditorsSyncProvider>
            </AppThemeProvider>
        </AppHashParamsSyncProvider>
    );
};
