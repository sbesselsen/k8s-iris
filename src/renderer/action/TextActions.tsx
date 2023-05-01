import { CopyIcon } from "@chakra-ui/icons";
import React, { useCallback } from "react";
import { Action, ActionClickResult, ActionGroup } from ".";
import { toK8sObjectIdentifier } from "../../common/k8s/util";

export const TextActions: React.FC<{}> = () => {
    const onClickCopyName = useCallback((result: ActionClickResult) => {
        const { resources } = result;
        const identifiers = resources.map(toK8sObjectIdentifier);
        const text = identifiers
            .map((identifier) => identifier.name)
            .join("\n");
        if (text) {
            navigator.clipboard.writeText(text);
        }
    }, []);

    return (
        <>
            <ActionGroup>
                <Action
                    id="copy-name"
                    label="Copy Name"
                    onClick={onClickCopyName}
                    buttonIcon={<CopyIcon />}
                />
            </ActionGroup>
        </>
    );
};
