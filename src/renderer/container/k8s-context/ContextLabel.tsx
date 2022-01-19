import React, { Fragment } from "react";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";

type ContextLabelProps = {
    context: string;
};

export const ContextLabel: React.FC<ContextLabelProps> = (props) => {
    const { context } = props;
    const [_isLoading, contextsInfo] = useK8sContextsInfo();
    const contextInfo = contextsInfo.find((ctx) => ctx.name === context);

    return (
        <Fragment>
            {contextInfo?.cloudInfo?.localClusterName ?? context}
        </Fragment>
    );
};
