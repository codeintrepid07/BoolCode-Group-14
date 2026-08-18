import { DomainError } from "../errors";
import type { BooleanExpression } from "./expressionParser";
import { GateDagBuilder, type GateDag } from "./gateDag";

function norNot(builder: GateDagBuilder, input: string): string {
  return builder.gate("NOR", input, input);
}

function norOr(builder: GateDagBuilder, left: string, right: string): string {
  const negatedOr = builder.gate("NOR", left, right);
  return builder.gate("NOR", negatedOr, negatedOr);
}

function norAnd(builder: GateDagBuilder, left: string, right: string): string {
  return builder.gate("NOR", norNot(builder, left), norNot(builder, right));
}

function compile(expression: BooleanExpression, builder: GateDagBuilder): string {
  switch (expression.type) {
    case "INPUT":
      return builder.input(expression.name);
    case "CONSTANT":
      return builder.input(expression.value ? "1" : "0");
    case "NOT":
      return norNot(builder, compile(expression.input, builder));
    case "AND":
      return norAnd(builder, compile(expression.inputs[0], builder), compile(expression.inputs[1], builder));
    case "OR":
      return norOr(builder, compile(expression.inputs[0], builder), compile(expression.inputs[1], builder));
  }
}

/** Recursively compiles Boolean operations into an interned 2-input NOR DAG. */
export function compileToNor(expression: BooleanExpression): GateDag {
  try {
    const builder = new GateDagBuilder();
    return builder.build(compile(expression, builder));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("NOR_COMPILATION_ERROR", "Unable to compile expression to a NOR gate DAG.");
  }
}
