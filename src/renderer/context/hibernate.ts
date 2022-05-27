import React, { createContext, useContext, useEffect } from "react";

const HibernateContext = createContext(false);

export function useHibernate(): boolean {
    return useContext(HibernateContext);
}

export const HibernateContainer: React.FC<{
    hibernate?: boolean;
}> = (props) => {
    const { hibernate = false, children } = props;

    const parentValue = useHibernate();

    return React.createElement(
        HibernateContext.Provider,
        { value: parentValue || hibernate },
        children
    );
};
