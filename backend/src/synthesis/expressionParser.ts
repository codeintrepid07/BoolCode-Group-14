import { DomainError } from "../errors";

export type BooleanExpression =
  | { type: "INPUT"; name: string }
  | { type: "CONSTANT"; value: boolean }
  | { type: "NOT"; input: BooleanExpression }
  | { type: "AND"; inputs: [BooleanExpression, BooleanExpression] }
  | { type: "OR"; inputs: [BooleanExpression, BooleanExpression] };

type Token =
  | { kind: "IDENTIFIER"; value: string; position: number }
  | { kind: "ZERO" | "ONE" | "PLUS" | "STAR" | "NOT" | "OPEN" | "CLOSE" | "EOF"; position: number };

type PunctuationTokenKind = "ZERO" | "ONE" | "PLUS" | "STAR" | "NOT" | "OPEN" | "CLOSE";

function tokenize(expression: string, variableNames?: readonly string[]): Token[] {
  const tokens: Token[] = [];
  const knownVariables = variableNames ? [...variableNames].sort((left, right) => right.length - left.length) : [];
  let position = 0;
  while (position < expression.length) {
    const character = expression[position];
    if (/\s/.test(character)) {
      position += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const start = position;
      const knownVariable = knownVariables.find((variable) => expression.startsWith(variable, position));
      if (knownVariable) {
        position += knownVariable.length;
        tokens.push({ kind: "IDENTIFIER", value: knownVariable, position: start });
        continue;
      }
      // The notebook's compact SOP format writes single-letter uppercase
      // variables adjacently (e.g. A'BC). With no variable list available,
      // retain that conventional interpretation while full identifiers remain
      // available for lower-case/underscore names and explicit `*` notation.
      if (/[A-Z]/.test(character)) {
        position += 1;
        tokens.push({ kind: "IDENTIFIER", value: character, position: start });
        continue;
      }
      position += 1;
      while (position < expression.length && /[A-Za-z0-9_]/.test(expression[position])) position += 1;
      tokens.push({ kind: "IDENTIFIER", value: expression.slice(start, position), position: start });
      continue;
    }
    const kindByCharacter: Record<string, PunctuationTokenKind | undefined> = {
      "0": "ZERO",
      "1": "ONE",
      "+": "PLUS",
      "*": "STAR",
      "'": "NOT",
      "(": "OPEN",
      ")": "CLOSE",
    };
    const kind = kindByCharacter[character];
    if (!kind) {
      throw new DomainError("EXPRESSION_PARSE_ERROR", `Unexpected character '${character}' at position ${position}.`);
    }
    tokens.push({ kind, position });
    position += 1;
  }
  tokens.push({ kind: "EOF", position });
  return tokens;
}

class Parser {
  private index = 0;

  public constructor(private readonly tokens: Token[]) {}

  public parse(): BooleanExpression {
    const expression = this.parseOr();
    if (this.current.kind !== "EOF") {
      throw this.error(`Unexpected token after a complete expression.`);
    }
    return expression;
  }

  private parseOr(): BooleanExpression {
    let left = this.parseAnd();
    while (this.consume("PLUS")) {
      left = { type: "OR", inputs: [left, this.parseAnd()] };
    }
    return left;
  }

  private parseAnd(): BooleanExpression {
    let left = this.parsePostfix();
    while (true) {
      if (this.consume("STAR")) {
        left = { type: "AND", inputs: [left, this.parsePostfix()] };
      } else if (this.isPrimaryStart(this.current)) {
        // Supports the notebook's compact SOP notation, e.g. A'BC.
        left = { type: "AND", inputs: [left, this.parsePostfix()] };
      } else {
        return left;
      }
    }
  }

  private parsePostfix(): BooleanExpression {
    let expression = this.parsePrimary();
    while (this.consume("NOT")) expression = { type: "NOT", input: expression };
    return expression;
  }

  private parsePrimary(): BooleanExpression {
    const token = this.current;
    if (token.kind === "IDENTIFIER") {
      this.index += 1;
      return { type: "INPUT", name: token.value };
    }
    if (token.kind === "ZERO" || token.kind === "ONE") {
      this.index += 1;
      return { type: "CONSTANT", value: token.kind === "ONE" };
    }
    if (this.consume("OPEN")) {
      const expression = this.parseOr();
      if (!this.consume("CLOSE")) throw this.error("Expected ')' to close parenthesized expression.");
      return expression;
    }
    throw this.error("Expected an input, constant, or parenthesized expression.");
  }

  private isPrimaryStart(token: Token): boolean {
    return token.kind === "IDENTIFIER" || token.kind === "ZERO" || token.kind === "ONE" || token.kind === "OPEN";
  }

  private consume(kind: Token["kind"]): boolean {
    if (this.current.kind !== kind) return false;
    this.index += 1;
    return true;
  }

  private get current(): Token {
    return this.tokens[this.index];
  }

  private error(message: string): DomainError {
    return new DomainError("EXPRESSION_PARSE_ERROR", `${message} Position ${this.current.position}.`);
  }
}

export function parseExpression(expression: string, variableNames?: readonly string[]): BooleanExpression {
  if (typeof expression !== "string" || expression.trim().length === 0) {
    throw new DomainError("EXPRESSION_PARSE_ERROR", "Expression must be a non-empty string.");
  }
  return new Parser(tokenize(expression, variableNames)).parse();
}

export function evaluateExpression(expression: BooleanExpression, inputs: Readonly<Record<string, boolean>>): boolean {
  switch (expression.type) {
    case "INPUT": {
      const value = inputs[expression.name];
      if (value === undefined) {
        throw new DomainError("EXPRESSION_PARSE_ERROR", `No value was supplied for input '${expression.name}'.`);
      }
      return value;
    }
    case "CONSTANT":
      return expression.value;
    case "NOT":
      return !evaluateExpression(expression.input, inputs);
    case "AND":
      return evaluateExpression(expression.inputs[0], inputs) && evaluateExpression(expression.inputs[1], inputs);
    case "OR":
      return evaluateExpression(expression.inputs[0], inputs) || evaluateExpression(expression.inputs[1], inputs);
  }
}
