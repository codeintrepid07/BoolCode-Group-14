import assert from "node:assert/strict";
import test from "node:test";
import { analyzeBooleanFunction } from "../api/analyze";
import { gateDagToCircuitGraph } from "../circuit/graph";
import { DomainError } from "../errors";
import { parseExpression } from "../synthesis/expressionParser";
import { assertNormalizedGateDag, evaluateGateDag, type GateDag } from "../synthesis/gateDag";
import { compileToNand } from "../synthesis/nandCompiler";
import { compileToNor } from "../synthesis/norCompiler";

function hasSharedFanOut(gateDag: GateDag): boolean {
  const downstreamNodesBySource = new Map<string, Set<string>>();
  for (const node of gateDag.nodes) {
    if (node.type === "INPUT") continue;
    for (const sourceId of node.inputs) {
      const targets = downstreamNodesBySource.get(sourceId) ?? new Set<string>();
      targets.add(node.id);
      downstreamNodesBySource.set(sourceId, targets);
    }
  }
  return [...downstreamNodesBySource.values()].some((targets) => targets.size > 1);
}

test("preserves the reference notebook's demonstration result", () => {
  const result = analyzeBooleanFunction({
    variables: ["A", "B", "C"],
    minterms: [0, 2, 3, 6, 7],
    dontCares: [],
  });
  assert.deepEqual(result.kmap.rowGrayCode, ["0", "1"]);
  assert.deepEqual(result.kmap.columnGrayCode, ["00", "01", "11", "10"]);
  assert.deepEqual(result.primeImplicants.map((item) => item.pattern), ["-1-", "0-0"]);
  assert.deepEqual(result.essentialPrimeImplicants.map((item) => item.pattern), ["-1-", "0-0"]);
  assert.equal(result.minimumSolutions.length, 1);
  assert.equal(result.minimumSolutions[0].expression, "B + A'C'");
});

test("four-variable fixture retains both equal-size minimum Boolean expressions", () => {
  const result = analyzeBooleanFunction({
    variables: ["A", "B", "C", "D"],
    minterms: [0, 1, 2, 5, 6, 7, 8, 9, 10, 13, 14, 15],
  });
  assert.ok(result.minimumSolutions.length > 1, "fixture must exercise multiple minimum covers");
  assert.equal(new Set(result.minimumSolutions.map((item) => item.expression)).size, result.minimumSolutions.length);
  assert.ok(result.minimumSolutions.every((item) => item.additionalImplicants.length === result.minimumSolutions[0].additionalImplicants.length));
  assert.deepEqual(
    result.minimumSolutions.map((item) => item.expression),
    ["C'D + B'D' + BC", "CD' + B'C' + BD"],
  );
  assert.ok(result.minimumSolutions.every((item) => item.nand.verification.passed && item.nor.verification.passed));
});

test("don't-care terms expand legal grouping and preserve the resulting minimum expression", () => {
  const result = analyzeBooleanFunction({
    variables: ["A", "B", "C"],
    minterms: [1, 3, 7],
    dontCares: [5],
  });
  assert.deepEqual(result.input.dontCares, [5]);
  assert.deepEqual(result.primeImplicants.map((item) => item.pattern), ["--1"]);
  assert.deepEqual(result.primeImplicants[0].coveredMinterms, [1, 3, 7]);
  assert.deepEqual(result.minimumSolutions.map((item) => item.expression), ["C"]);
  assert.equal(result.minimumSolutions[0].nand.verification.passed, true);
  assert.equal(result.minimumSolutions[0].nor.verification.passed, true);
});

test("NAND and NOR compilers emit normalized shared-node DAGs and preserve logic", () => {
  // A' is used in both product terms and must become one shared DAG node, not
  // two copied branches. NOR derives a shared inversion stage for the same use.
  const expression = parseExpression("A'B + A'C");
  const nand = compileToNand(expression);
  const nor = compileToNor(expression);
  assertNormalizedGateDag(nand, "NAND");
  assertNormalizedGateDag(nor, "NOR");
  assert.ok(hasSharedFanOut(nand), "NAND DAG must preserve a shared subexpression fan-out");
  assert.ok(hasSharedFanOut(nor), "NOR DAG must preserve a shared subexpression fan-out");

  const nandGraph = gateDagToCircuitGraph(nand);
  assert.equal(nandGraph.nodes.length, nand.nodes.length, "Graph must emit each DAG node once.");
  assert.ok(
    [...new Set(nandGraph.links.map((link) => link.source))].some(
      (source) => new Set(nandGraph.links.filter((link) => link.source === source).map((link) => link.target)).size > 1,
    ),
    "Graph must expose a source node with multiple downstream targets.",
  );

  for (const A of [false, true]) {
    for (const B of [false, true]) {
      for (const C of [false, true]) {
        const expected = (!A && B) || (!A && C);
        assert.equal(evaluateGateDag(nand, { A, B, C }), expected);
        assert.equal(evaluateGateDag(nor, { A, B, C }), expected);
      }
    }
  }
});

test("returns structured domain errors for malformed term input", () => {
  assert.throws(
    () => analyzeBooleanFunction({ variables: ["A", "B"], minterms: [4] }),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_MINTERM",
  );
});
