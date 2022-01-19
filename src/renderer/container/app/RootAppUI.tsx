import { Button } from "@chakra-ui/react";
import React, { Fragment, useCallback } from "react";
import { useAppRoute, useAppRouteActions } from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { ContextLabel } from "../k8s-context/ContextLabel";
import { ContextSelectScreen } from "../k8s-context/ContextSelectScreen";

export const RootAppUI: React.FunctionComponent = () => {
    const { isSelectingContext, context } = useAppRoute();
    const { toggleContextSelector } = useAppRouteActions();

    usePageTitle(isSelectingContext ? undefined : context);

    const onClick = useCallback(() => {
        toggleContextSelector(true);
    }, [toggleContextSelector]);

    return (
        <Fragment>
            {isSelectingContext && <ContextSelectScreen />}
            {!isSelectingContext && (
                <Button onClick={onClick}>
                    <ContextLabel context={context} />
                </Button>
            )}
        </Fragment>
    );
};
