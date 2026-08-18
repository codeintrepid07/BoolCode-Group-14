import { DomainError } from "../errors";
import type { BooleanExpression } from "./expressionParser";
import { GateDagBuilder, type GateDag } from "./gateDag";

function nandNot(builder: GateDagBuilder, input: string): string {
  return builder.gate("NAND", input, input);
}

function nandAnd(builder: GateDagBuilder, left: string, right: string): string {
  const negatedAnd = builder.gate("NAND", left, right);
  return builder.gate("NAND", negatedAnd, negatedAnd);
}

function nandOr(builder: GateDagBuilder, left: string, right: string): string {
  return builder.gate("NAND", nandNot(builder, left), nandNot(builder, right));
}

function compile(expression: BooleanExpression, builder: GateDagBuilder): string {
  switch (expression.type) {
    case "INPUT":
      return builder.input(expression.name);
    case "CONSTANT":
      return builder.input(expression.value ? "1" : "0");
    case "NOT":
      return nandNot(builder, compile(expression.input, builder));
    case "AND":
      return nandAnd(builder, compile(expression.inputs[0], builder), compile(expression.inputs[1], builder));
    case "OR":
      return nandOr(builder, compile(expression.inputs[0], builder), compile(expression.inputs[1], builder));
  }
}

/** Recursively compiles Boolean operations into an interned 2-input NAND DAG. */
export function compileToNand(expression: BooleanExpression): GateDag {
  try {
    const builder = new GateDagBuilder();
    return builder.build(compile(expression, builder));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("NAND_COMPILATION_ERROR", "Unable to compile expression to a NAND gate DAG.");
  }
}
