import { useRef } from "react";
import { K8sObject } from "../../common/k8s/client";
import { objSameRef } from "../../common/k8s/util";

export function useStableK8sObject<T extends K8sObject>(object: T): T {
    const objectRef = useRef(object);
    if (!objSameRef(object, objectRef.current)) {
        objectRef.current = object;
    }
    return objectRef.current;
}
