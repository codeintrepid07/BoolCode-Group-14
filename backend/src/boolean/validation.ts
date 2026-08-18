import { DomainError } from "../errors";
import type { AnalyzeRequest, NormalizedRequest } from "./types";

/**
 * The reference notebook has no explicit size ceiling, but its exhaustive cover
 * search is exponential. Six variables keeps the public API predictable while
 * preserving all covers instead of silently selecting a single result.
 */
export const MAX_VARIABLES = 6;

export function normalizeRequest(body: unknown): NormalizedRequest {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new DomainError("MALFORMED_REQUEST", "Request body must be a JSON object.");
  }

  const request = body as Partial<AnalyzeRequest> & { inputType?: unknown };
  if (request.inputType !== undefined && request.inputType !== "minterms") {
    throw new DomainError(
      "UNSUPPORTED_INPUT_TYPE",
      "Only inputType 'minterms' is supported because it is the input format provided by the reference notebook.",
      { details: { received: request.inputType } },
    );
  }

  if (!Array.isArray(request.variables) || request.variables.length === 0) {
    throw new DomainError("INVALID_VARIABLES", "variables must be a non-empty array of variable names.");
  }
  if (request.variables.length > MAX_VARIABLES) {
    throw new DomainError(
      "UNSUPPORTED_VARIABLE_COUNT",
      `At most ${MAX_VARIABLES} variables are supported by the exhaustive minimum-cover search.`,
      { details: { received: request.variables.length, maximum: MAX_VARIABLES } },
    );
  }
  if (
    request.variables.some(
      (name) => typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name),
    )
  ) {
    throw new DomainError(
      "INVALID_VARIABLES",
      "Every variable name must be a non-empty identifier containing letters, digits, or underscores.",
    );
  }
  if (new Set(request.variables).size !== request.variables.length) {
    throw new DomainError("INVALID_VARIABLES", "Variable names must be unique.");
  }

  if (!Array.isArray(request.minterms)) {
    throw new DomainError("INVALID_MINTERM", "minterms must be an array of integer indices.");
  }
  const rawDontCares = request.dontCares ?? [];
  if (!Array.isArray(rawDontCares)) {
    throw new DomainError("INVALID_DONT_CARE", "dontCares must be an array of integer indices.");
  }

  const limit = 2 ** request.variables.length;
  const normalizeTerms = (terms: unknown[], code: "INVALID_MINTERM" | "INVALID_DONT_CARE", label: string) => {
    if (terms.some((term) => !Number.isInteger(term) || (term as number) < 0 || (term as number) >= limit)) {
      throw new DomainError(code, `${label} must contain integer indices from 0 through ${limit - 1}.`, {
        details: { received: terms, limit },
      });
    }
    return [...new Set(terms as number[])].sort((a, b) => a - b);
  };

  const minterms = normalizeTerms(request.minterms, "INVALID_MINTERM", "minterms");
  const dontCares = normalizeTerms(rawDontCares, "INVALID_DONT_CARE", "dontCares");
  const overlaps = dontCares.filter((term) => minterms.includes(term));
  if (overlaps.length > 0) {
    throw new DomainError(
      "OVERLAPPING_TERMS",
      "A minterm cannot also be a don't-care term.",
      { details: { overlappingTerms: overlaps } },
    );
  }

  return {
    variables: [...request.variables],
    minterms,
    dontCares,
    variableCount: request.variables.length,
  };
}
