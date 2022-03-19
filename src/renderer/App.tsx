import React from "react";

import { RootAppUI } from "./container/app/RootAppUI";
import { AppThemeProvider } from "./container/app/AppThemeProvider";
import { AppHashParamsSync } from "./container/app/AppHashParamsSync";

export const App: React.FunctionComponent = () => {
    return (
        <AppThemeProvider>
            <AppHashParamsSync />
            <RootAppUI />
        </AppThemeProvider>
    );
};
