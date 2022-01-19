import { useEffect } from "react";

export const usePageTitle = (title?: string | undefined) => {
    useEffect(() => {
        document.title = title ?? "Charm";
    }, [title]);
};
