import type { BooleanExpression } from "./expressionParser";
import { evaluateExpression } from "./expressionParser";
import type { CircuitVerification, GateDag } from "./gateDag";
import { evaluateGateDag } from "./gateDag";

export function verifyGateDag(
  expression: BooleanExpression,
  gateDag: GateDag,
  variables: readonly string[],
): CircuitVerification {
  const mismatches: CircuitVerification["mismatches"] = [];
  const combinations = 2 ** variables.length;
  for (let minterm = 0; minterm < combinations; minterm += 1) {
    const inputs = Object.fromEntries(
      variables.map((variable, index) => {
        const shift = variables.length - index - 1;
        return [variable, Boolean((minterm >> shift) & 1)];
      }),
    );
    const expected = evaluateExpression(expression, inputs);
    const actual = evaluateGateDag(gateDag, inputs);
    if (expected !== actual) mismatches.push({ inputs, expected, actual });
  }
  return { passed: mismatches.length === 0, checkedCombinations: combinations, mismatches };
}
