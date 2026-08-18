import { gateDagToCircuitGraph, type CircuitGraph } from "../circuit/graph";
import { DomainError } from "../errors";
import { generateKmap } from "../boolean/kmap";
import {
  describeImplicant,
  minimize,
  solutionToExpression,
} from "../boolean/quineMcCluskey";
import { generateTruthTable } from "../boolean/truthTable";
import type { AnalyzeRequest, Implicant, InputType, Kmap, PrimeChartEntry, TruthTable } from "../boolean/types";
import { normalizeRequest } from "../boolean/validation";
import { parseExpression } from "../synthesis/expressionParser";
import { assertNormalizedGateDag, type CircuitVerification, type GateDag } from "../synthesis/gateDag";
import { compileToNand } from "../synthesis/nandCompiler";
import { compileToNor } from "../synthesis/norCompiler";
import { verifyGateDag } from "../synthesis/verification";

export interface CompiledCircuit {
  gateDag: GateDag;
  graph: CircuitGraph;
  verification: CircuitVerification;
}

export interface MinimumSolution {
  additionalImplicants: string[];
  implicants: string[];
  expression: string;
  nand: CompiledCircuit;
  nor: CompiledCircuit;
}

export interface AnalysisResponse {
  input: {
    inputType: InputType;
    variables: string[];
    /** Actual on-set supplied to the minterm-compatible Boolean engine. */
    normalizedMinterms: number[];
    minterms?: number[];
    maxterms?: number[];
    dontCares: number[];
  };
  truthTable: TruthTable;
  kmap: Kmap;
  primeImplicants: Implicant[];
  essentialPrimeImplicants: Implicant[];
  nonEssentialPrimeImplicants: Implicant[];
  primeImplicantChart: PrimeChartEntry[];
  reducedPrimeImplicantChart: PrimeChartEntry[];
  allValidAdditionalCovers: string[][];
  minimumSolutions: MinimumSolution[];
}

function compileCircuit(
  expressionText: string,
  variables: readonly string[],
  target: "NAND" | "NOR",
): CompiledCircuit {
  const expression = parseExpression(expressionText, variables);
  const gateDag = target === "NAND" ? compileToNand(expression) : compileToNor(expression);
  assertNormalizedGateDag(gateDag, target);
  const verification = verifyGateDag(expression, gateDag, variables);
  if (!verification.passed) {
    throw new DomainError(
      target === "NAND" ? "NAND_COMPILATION_ERROR" : "NOR_COMPILATION_ERROR",
      `${target} compilation did not preserve Boolean equivalence.`,
      { details: { mismatches: verification.mismatches } },
    );
  }
  return { gateDag, graph: gateDagToCircuitGraph(gateDag), verification };
}

/**
 * Single service entry point shared by the HTTP API and tests. It preserves the
 * entire minimization hierarchy, including every minimum additional cover.
 */
export function analyzeBooleanFunction(body: AnalyzeRequest | unknown): AnalysisResponse {
  const input = normalizeRequest(body);
  const minimization = minimize(input);
  const primeImplicants = minimization.primePatterns.map((pattern) => describeImplicant(pattern, input));
  const essentialSet = new Set(minimization.essentialPatterns);
  const essentialPrimeImplicants = primeImplicants.filter((implicant) => essentialSet.has(implicant.pattern));
  const nonEssentialPrimeImplicants = primeImplicants.filter((implicant) => !essentialSet.has(implicant.pattern));

  const minimumSolutions = minimization.minimumAdditionalCovers.map((additionalImplicants) => {
    const expression = solutionToExpression(minimization.essentialPatterns, additionalImplicants, input.variables);
    return {
      additionalImplicants,
      implicants: [...minimization.essentialPatterns, ...additionalImplicants],
      expression,
      nand: compileCircuit(expression, input.variables, "NAND"),
      nor: compileCircuit(expression, input.variables, "NOR"),
    };
  });

  return {
    input: input.inputType === "minterms"
      ? {
          inputType: "minterms",
          variables: input.variables,
          minterms: input.specifiedTerms,
          normalizedMinterms: input.minterms,
          dontCares: input.dontCares,
        }
      : {
          inputType: "maxterms",
          variables: input.variables,
          maxterms: input.specifiedTerms,
          normalizedMinterms: input.minterms,
          dontCares: input.dontCares,
        },
    truthTable: generateTruthTable(input),
    kmap: generateKmap(input),
    primeImplicants,
    essentialPrimeImplicants,
    nonEssentialPrimeImplicants,
    primeImplicantChart: minimization.primeChart,
    reducedPrimeImplicantChart: minimization.reducedPrimeChart,
    allValidAdditionalCovers: minimization.allValidAdditionalCovers,
    minimumSolutions,
  };
}
