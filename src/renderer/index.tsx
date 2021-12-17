import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./App";

import { initializeIcons } from "@fluentui/react/lib/Icons";
initializeIcons("./fluentui-fonts/");

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById("root")
);
