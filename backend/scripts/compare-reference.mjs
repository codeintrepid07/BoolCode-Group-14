import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { analyzeBooleanFunction } from "../dist/api/analyze.js";

const cases = [
  { label: "notebook demonstration case", variables: ["A", "B", "C"], minterms: [0, 2, 3, 6, 7], dontCares: [] },
  { label: "don't-care-assisted grouping", variables: ["A", "B", "C"], minterms: [1, 3, 7], dontCares: [5] },
  { label: "four-variable alternate-cover case", variables: ["A", "B", "C", "D"], minterms: [0, 1, 2, 5, 6, 7, 8, 9, 10, 13, 14, 15], dontCares: [] },
];

for (const sample of cases) {
  const oracleRun = spawnSync("python", ["scripts/reference_oracle.py"], {
    input: JSON.stringify(sample),
    encoding: "utf8",
  });
  assert.equal(oracleRun.status, 0, oracleRun.stderr);
  const oracle = JSON.parse(oracleRun.stdout);
  const actual = analyzeBooleanFunction(sample);

  assert.deepEqual(actual.truthTable.rows, oracle.truthTable, `${sample.label}: truth table`);
  assert.deepEqual(
    { rowGrayCode: actual.kmap.rowGrayCode, columnGrayCode: actual.kmap.columnGrayCode, cells: actual.kmap.cells },
    oracle.kmap,
    `${sample.label}: K-map`,
  );
  assert.deepEqual(actual.primeImplicants.map((entry) => entry.pattern), oracle.primePatterns, `${sample.label}: prime implicants`);
  assert.deepEqual(actual.primeImplicantChart, oracle.primeChart, `${sample.label}: prime chart`);
  assert.deepEqual(actual.essentialPrimeImplicants.map((entry) => entry.pattern), oracle.essentialPatterns, `${sample.label}: essential implicants`);
  assert.deepEqual(actual.reducedPrimeImplicantChart, oracle.reducedPrimeChart, `${sample.label}: reduced chart`);
  assert.deepEqual(actual.allValidAdditionalCovers, oracle.allValidAdditionalCovers, `${sample.label}: all covers`);
  assert.deepEqual(actual.minimumSolutions.map((entry) => entry.additionalImplicants), oracle.minimumAdditionalCovers, `${sample.label}: minimum covers`);
  assert.deepEqual(actual.minimumSolutions.map((entry) => entry.expression), oracle.expressions, `${sample.label}: expressions`);
  for (const solution of actual.minimumSolutions) {
    assert.equal(solution.nand.verification.passed, true, `${sample.label}: NAND equivalence`);
    assert.equal(solution.nor.verification.passed, true, `${sample.label}: NOR equivalence`);
  }
}
console.log(`Reference comparison passed for ${cases.length} cases.`);
