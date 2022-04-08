import React, { useEffect, useState } from "react";

export const Defer: React.FC<{ initialize: boolean }> = (props) => {
    const { initialize, children } = props;

    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (!shouldRender && initialize) {
            setShouldRender(true);
        }
    }, [initialize, shouldRender, setShouldRender]);

    if (!shouldRender && !initialize) {
        return null;
    }
    return <>{children}</>;
};
