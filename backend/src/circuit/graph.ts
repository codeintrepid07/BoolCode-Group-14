import type { GateDag } from "../synthesis/gateDag";

export interface CircuitGraphNode {
  id: string;
  type: "INPUT" | "NAND" | "NOR";
  label: string;
}

export interface CircuitGraphLink {
  source: string;
  target: string;
  targetPort: "in1" | "in2";
}

export interface CircuitGraph {
  nodes: CircuitGraphNode[];
  links: CircuitGraphLink[];
  outputNodeId: string;
}

/**
 * Converts the shared-node gate DAG to renderer data. A node appears once even
 * when it has multiple outbound links, so JointJS can render genuine fan-out.
 */
export function gateDagToCircuitGraph(gateDag: GateDag): CircuitGraph {
  const nodes = gateDag.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node.type === "INPUT" ? node.name : node.type,
  }));
  const links = gateDag.nodes.flatMap((node) => {
    if (node.type === "INPUT") return [];
    return [
      { source: node.inputs[0], target: node.id, targetPort: "in1" as const },
      { source: node.inputs[1], target: node.id, targetPort: "in2" as const },
    ];
  });
  return { nodes, links, outputNodeId: gateDag.outputNodeId };
}
