import { BrowserWindow } from "electron";
import * as path from "path";

import { K8sLocation } from "../../common/k8s/location";

export type WindowManager = {
    createClusterWindow(location?: K8sLocation): Promise<string>;
};

type WindowHandle = {
    window: BrowserWindow;
};

export function createWindowManager(): WindowManager {
    const windowHandles: Record<string, WindowHandle> = {};

    const generateWindowId = (() => {
        let counter = 0;
        return () => `win-${counter++}`;
    })();

    const createClusterWindow = async (
        location: K8sLocation = {}
    ): Promise<string> => {
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            title: "Charm",
            webPreferences: {
                preload: path.join(__dirname, "..", "preload", "index.js"),
            },
        });

        win.loadFile(path.join(__dirname, "..", "renderer", "index.html"), {
            search: Buffer.from(JSON.stringify(location), "utf-8").toString(
                "base64"
            ),
        });

        const windowId = generateWindowId();
        windowHandles[windowId] = {
            window: win,
        };
        return windowId;
    };

    return {
        createClusterWindow,
    };
}
