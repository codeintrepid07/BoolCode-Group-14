import { DomainError } from "../errors";

export type GateKind = "NAND" | "NOR";

/**
 * A normalized universal-gate DAG node. `inputs` stores references to existing
 * node IDs, allowing one compiled subexpression to fan out into many gates.
 */
export type GateDagNode =
  | { id: string; type: "INPUT"; name: string }
  | { id: string; type: "NAND"; inputs: [string, string] }
  | { id: string; type: "NOR"; inputs: [string, string] };

/**
 * Renderer-independent circuit topology. Unlike the old recursive tree, this
 * is a directed acyclic graph: a node is defined once and reused by reference.
 */
export interface GateDag {
  nodes: GateDagNode[];
  outputNodeId: string;
}

export interface CircuitVerification {
  passed: boolean;
  checkedCombinations: number;
  mismatches: Array<{ inputs: Record<string, boolean>; expected: boolean; actual: boolean }>;
}

/**
 * Interns structurally identical nodes. Inputs are interned by name and gate
 * nodes by universal-gate kind plus canonical input pair. Canonical ordering is
 * valid because NAND and NOR are commutative, and it maximizes sharing.
 */
export class GateDagBuilder {
  private readonly nodes: GateDagNode[] = [];
  private readonly idBySignature = new Map<string, string>();
  private nextId = 0;

  public input(name: string): string {
    return this.intern(`INPUT:${name}`, () => ({ id: this.newId(), type: "INPUT", name }));
  }

  public gate(kind: GateKind, left: string, right: string): string {
    const [first, second] = [left, right].sort();
    return this.intern(`${kind}:${first}:${second}`, () => ({
      id: this.newId(),
      type: kind,
      inputs: [first, second],
    }));
  }

  public build(outputNodeId: string): GateDag {
    const dag = { nodes: [...this.nodes], outputNodeId };
    assertWellFormedGateDag(dag);
    return dag;
  }

  private intern(signature: string, factory: () => GateDagNode): string {
    const existing = this.idBySignature.get(signature);
    if (existing) return existing;
    const node = factory();
    this.idBySignature.set(signature, node.id);
    this.nodes.push(node);
    return node.id;
  }

  private newId(): string {
    const id = `g${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}

export function assertWellFormedGateDag(dag: GateDag): void {
  const nodes = new Map(dag.nodes.map((node) => [node.id, node]));
  if (nodes.size !== dag.nodes.length) {
    throw new DomainError("CIRCUIT_GENERATION_ERROR", "A gate DAG cannot contain duplicate node IDs.");
  }
  if (!nodes.has(dag.outputNodeId)) {
    throw new DomainError("CIRCUIT_GENERATION_ERROR", "The gate DAG output node must exist.");
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new DomainError("CIRCUIT_GENERATION_ERROR", "Gate DAG contains a cycle.");
    }
    const node = nodes.get(id);
    if (!node) {
      throw new DomainError("CIRCUIT_GENERATION_ERROR", `Gate DAG references missing node '${id}'.`);
    }
    visiting.add(id);
    if (node.type !== "INPUT") {
      if (node.inputs.length !== 2) {
        throw new DomainError("CIRCUIT_GENERATION_ERROR", `${node.type} node '${node.id}' must have exactly two inputs.`);
      }
      node.inputs.forEach(visit);
    }
    visiting.delete(id);
    visited.add(id);
  };
  visit(dag.outputNodeId);
}

export function evaluateGateDag(dag: GateDag, inputs: Readonly<Record<string, boolean>>): boolean {
  assertWellFormedGateDag(dag);
  const nodes = new Map(dag.nodes.map((node) => [node.id, node]));
  const memo = new Map<string, boolean>();
  const evaluate = (id: string): boolean => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = nodes.get(id);
    if (!node) throw new DomainError("CIRCUIT_GENERATION_ERROR", `Gate DAG references missing node '${id}'.`);

    let value: boolean;
    if (node.type === "INPUT") {
      if (node.name === "0") value = false;
      else if (node.name === "1") value = true;
      else {
        const supplied = inputs[node.name];
        if (supplied === undefined) {
          throw new DomainError("CIRCUIT_GENERATION_ERROR", `No value was supplied for gate-DAG input '${node.name}'.`);
        }
        value = supplied;
      }
    } else {
      const left = evaluate(node.inputs[0]);
      const right = evaluate(node.inputs[1]);
      value = node.type === "NAND" ? !(left && right) : !(left || right);
    }
    memo.set(id, value);
    return value;
  };
  return evaluate(dag.outputNodeId);
}

export function assertNormalizedGateDag(dag: GateDag, expectedGate: GateKind): void {
  assertWellFormedGateDag(dag);
  for (const node of dag.nodes) {
    if (node.type !== "INPUT" && node.type !== expectedGate) {
      throw new DomainError(
        "CIRCUIT_GENERATION_ERROR",
        `Expected a normalized binary ${expectedGate} DAG but found ${node.type}.`,
      );
    }
  }
}
