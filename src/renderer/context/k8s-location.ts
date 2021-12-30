import { createContext } from "react";
import { K8sLocation } from "../../common/k8s/location";

export const K8sLocationContext = createContext<K8sLocation>({});
