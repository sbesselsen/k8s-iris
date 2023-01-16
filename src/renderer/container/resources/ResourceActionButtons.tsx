import {
    Box,
    Button,
    ButtonProps,
    IconButton,
    IconButtonProps,
} from "@chakra-ui/react";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ContextMenuResult } from "../../../common/contextmenu";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { ActionsCollector, ActionTemplate } from "../../action";
import {
    ContextMenuButton,
    MenuItem,
} from "../../component/main/ContextMenuButton";
import { useModifierKeyRef } from "../../hook/keyboard";

export type ResourceActionButtonsProps = {
    resources: Array<K8sObject | K8sObjectIdentifier>;
    omitActions?: string[];
};

export const ResourceActionButtons: React.FC<ResourceActionButtonsProps> = (
    props
) => {
    const { omitActions, resources } = props;

    const getActionsRef = useRef<
        (
            resources: Array<K8sObject | K8sObjectIdentifier>
        ) => Array<Array<ActionTemplate>>
    >(() => []);

    const [actionGroups, setActionGroups] = useState<
        Array<Array<ActionTemplate>>
    >([]);

    useEffect(() => {
        const omitActionIds = new Set<string>(omitActions ?? []);
        const actionGroups = getActionsRef
            .current(resources)
            .map((actions) => actions.filter((a) => !omitActionIds.has(a.id)))
            .filter((group) => group.length > 0);
        setActionGroups(actionGroups);
    }, [getActionsRef, omitActions, resources, setActionGroups]);

    return (
        <>
            <ActionsCollector getActionsRef={getActionsRef} />
            {actionGroups.map((actions, i) => (
                <Box key={i}>
                    {actions.map((action) => (
                        <ResourceActionButton
                            action={action}
                            resources={resources}
                            key={action.id}
                        />
                    ))}
                </Box>
            ))}
        </>
    );
};

type ResourceActionButtonProps = {
    action: ActionTemplate;
    resources: Array<K8sObject | K8sObjectIdentifier>;
};

const ResourceActionButton: React.FC<ResourceActionButtonProps> = (props) => {
    const { action, resources } = props;

    const isVisible = useMemo(
        () => action.isVisible?.(resources) ?? true,
        [action, resources]
    );
    const subOptions = useMemo(
        () => (isVisible ? action.subOptions?.(resources) : undefined),
        [action, isVisible, resources]
    );

    const metaKeyRef = useModifierKeyRef("Meta");
    const altKeyRef = useModifierKeyRef("Alt");

    const onClick = useCallback(() => {
        action.onClick({
            resources,
            altKey: altKeyRef.current,
            metaKey: metaKeyRef.current,
        });
    }, [action, altKeyRef, metaKeyRef, resources]);

    const onClickSubAction = useCallback(
        (result: ContextMenuResult & { actionId: string }) => {
            action.onClick({
                resources,
                ...result,
                subOptionId: result.actionId,
            });
        },
        [action, resources]
    );

    const buttonProps: ButtonProps & IconButtonProps = {
        disabled: action.enabled ?? false,
        "aria-label": action.label,
    };
    if (action.buttonIcon) {
        buttonProps.as = IconButton;
        buttonProps.icon = action.buttonIcon;
    }

    if (!isVisible) {
        return null;
    }

    if (subOptions) {
        return (
            <ContextMenuButton
                title={action.toolTip ?? action.label}
                label={action.label}
                onMenuAction={onClickSubAction}
                {...buttonProps}
            >
                {subOptions.map(({ id, label }) => (
                    <MenuItem actionId={id} label={label} key={id} />
                ))}
            </ContextMenuButton>
        );
    }

    return (
        <Button
            title={action.toolTip ?? action.label}
            onClick={onClick}
            {...buttonProps}
        >
            {action.label}
        </Button>
    );
};
