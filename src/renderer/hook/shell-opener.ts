import { useCallback } from "react";
import { useEditorOpener } from "./editor-link";

let localShellIndex = 1;

export function useLocalShellEditorOpener(): () => void {
    const openEditor = useEditorOpener();
    return useCallback(() => {
        const index = localShellIndex++;
        openEditor({
            id: `local-shell:${index}`,
            name: "Shell" + (index === 1 ? "" : ` (${index})`),
            type: "local-shell",
        });
    }, [openEditor]);
}
