export type ErrorCode =
  | "MALFORMED_REQUEST"
  | "UNSUPPORTED_INPUT_TYPE"
  | "INVALID_VARIABLES"
  | "UNSUPPORTED_VARIABLE_COUNT"
  | "INVALID_MINTERM"
  | "INVALID_DONT_CARE"
  | "OVERLAPPING_TERMS"
  | "EXPRESSION_PARSE_ERROR"
  | "MINIMIZATION_ERROR"
  | "NAND_COMPILATION_ERROR"
  | "NOR_COMPILATION_ERROR"
  | "CIRCUIT_GENERATION_ERROR";

export class DomainError extends Error {
  public readonly status: number;

  public constructor(
    public readonly code: ErrorCode,
    message: string,
    options: { status?: number; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.status = options.status ?? 400;
    this.details = options.details;
  }

  public readonly details?: Record<string, unknown>;
}
