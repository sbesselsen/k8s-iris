import React from "react";

import { RootAppUI } from "./container/app/RootAppUI";
import { AppThemeProvider } from "./container/app/AppThemeProvider";
import { AppHashParamsSyncProvider } from "./container/app/AppHashParamsSyncProvider";
import { AppEditorsSyncProvider } from "./container/app/AppEditorsSyncProvider";
import { AppActionsProvider } from "./container/app/AppActionsProvider";

export const App: React.FunctionComponent = () => {
    return (
        <AppThemeProvider>
            <AppHashParamsSyncProvider>
                <AppEditorsSyncProvider>
                    <AppActionsProvider>
                        <RootAppUI />
                    </AppActionsProvider>
                </AppEditorsSyncProvider>
            </AppHashParamsSyncProvider>
        </AppThemeProvider>
    );
};
