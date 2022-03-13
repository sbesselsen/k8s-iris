import React from "react";

import { RootAppUI } from "./container/app/RootAppUI";
import { AppThemeProvider } from "./container/app/AppThemeProvider";

export const App: React.FunctionComponent = () => {
    return (
        <AppThemeProvider>
            <RootAppUI />
        </AppThemeProvider>
    );
};
