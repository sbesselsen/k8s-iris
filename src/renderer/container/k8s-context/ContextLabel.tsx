import { Spinner } from "@chakra-ui/react";
import React, { Fragment } from "react";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";

type ContextLabelProps = {
    context: string;
};

export const ContextLabel: React.FC<ContextLabelProps> = (props) => {
    const { context } = props;
    const [isLoading, contextsInfo] = useK8sContextsInfo();
    const contextInfo = contextsInfo.find((ctx) => ctx.name === context);

    return (
        <Fragment>
            {isLoading && <Spinner />}
            {!isLoading &&
                (contextInfo?.cloudInfo?.localClusterName ?? context)}
        </Fragment>
    );
};
