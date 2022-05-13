import React from "react";

import { RootAppUI } from "./container/app/RootAppUI";
import { AppThemeProvider } from "./container/app/AppThemeProvider";
import { AppHashParamsSyncProvider } from "./container/app/AppHashParamsSyncProvider";
import { AppEditorsSyncProvider } from "./container/app/AppEditorsSyncProvider";

export const App: React.FunctionComponent = () => {
    return (
        <AppThemeProvider>
            <AppHashParamsSyncProvider>
                <AppEditorsSyncProvider>
                    <RootAppUI />
                </AppEditorsSyncProvider>
            </AppHashParamsSyncProvider>
        </AppThemeProvider>
    );
};
