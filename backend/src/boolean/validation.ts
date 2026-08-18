import { DomainError } from "../errors";
import type { InputType, NormalizedRequest } from "./types";

/**
 * The reference notebook has no explicit size ceiling, but its exhaustive cover
 * search is exponential. Six variables keeps the public API predictable while
 * preserving all covers instead of silently selecting a single result.
 */
export const MAX_VARIABLES = 6;

type RawRequest = {
  inputType?: unknown;
  variables?: unknown;
  minterms?: unknown;
  maxterms?: unknown;
  dontCares?: unknown;
};

export function normalizeRequest(body: unknown): NormalizedRequest {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new DomainError("MALFORMED_REQUEST", "Request body must be a JSON object.");
  }

  const request = body as RawRequest;
  const inputType: InputType = request.inputType === undefined ? "minterms" : request.inputType as InputType;
  if (inputType !== "minterms" && inputType !== "maxterms") {
    throw new DomainError(
      "UNSUPPORTED_INPUT_TYPE",
      "inputType must be either 'minterms' or 'maxterms'.",
      { details: { received: request.inputType } },
    );
  }
  if (request.minterms !== undefined && request.maxterms !== undefined) {
    throw new DomainError(
      "CONFLICTING_TERM_INPUTS",
      "Provide either minterms or maxterms, not both.",
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

  const rawTerms = inputType === "minterms" ? request.minterms : request.maxterms;
  const termLabel = inputType === "minterms" ? "minterms" : "maxterms";
  const termErrorCode: "INVALID_MINTERM" | "INVALID_MAXTERM" = inputType === "minterms"
    ? "INVALID_MINTERM"
    : "INVALID_MAXTERM";
  if (!Array.isArray(rawTerms)) {
    throw new DomainError(termErrorCode, `${termLabel} must be an array of integer indices.`);
  }
  const rawDontCares = request.dontCares ?? [];
  if (!Array.isArray(rawDontCares)) {
    throw new DomainError("INVALID_DONT_CARE", "dontCares must be an array of integer indices.");
  }

  const limit = 2 ** request.variables.length;
  const normalizeTerms = (
    terms: unknown[],
    code: "INVALID_MINTERM" | "INVALID_MAXTERM" | "INVALID_DONT_CARE",
    label: string,
  ) => {
    if (terms.some((term) => !Number.isInteger(term) || (term as number) < 0 || (term as number) >= limit)) {
      throw new DomainError(code, `${label} must contain integer indices from 0 through ${limit - 1}.`, {
        details: { received: terms, limit },
      });
    }
    return [...new Set(terms as number[])].sort((a, b) => a - b);
  };

  const specifiedTerms = normalizeTerms(rawTerms, termErrorCode, termLabel);
  const dontCares = normalizeTerms(rawDontCares, "INVALID_DONT_CARE", "dontCares");
  const overlaps = dontCares.filter((term) => specifiedTerms.includes(term));
  if (overlaps.length > 0) {
    throw new DomainError(
      "OVERLAPPING_TERMS",
      `A ${inputType === "minterms" ? "minterm" : "maxterm"} cannot also be a don't-care term.`,
      { details: { overlappingTerms: overlaps } },
    );
  }

  const minterms = inputType === "minterms"
    ? specifiedTerms
    : Array.from({ length: limit }, (_, term) => term).filter(
        (term) => !specifiedTerms.includes(term) && !dontCares.includes(term),
      );

  return {
    inputType,
    variables: [...request.variables],
    minterms,
    specifiedTerms,
    dontCares,
    variableCount: request.variables.length,
  };
}
