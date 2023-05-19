import React, { PropsWithChildren, useRef } from "react";

export const LazyComponent: React.FC<
    PropsWithChildren<{ isActive: boolean }>
> = (props) => {
    const { isActive, children } = props;

    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive || isActiveRef.current;

    return isActiveRef.current ? <>{children}</> : null;
};
