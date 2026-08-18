import type { Implicant, NormalizedRequest, PrimeChartEntry } from "./types";

export interface MinimizationDetails {
  primePatterns: string[];
  primeChart: PrimeChartEntry[];
  essentialPatterns: string[];
  reducedPrimeChart: PrimeChartEntry[];
  allValidAdditionalCovers: string[][];
  minimumAdditionalCovers: string[][];
}

export function decimalToBinary(minterms: readonly number[], variableCount: number): string[] {
  return minterms.map((minterm) => minterm.toString(2).padStart(variableCount, "0"));
}

export function groupMinterms(binaryTerms: readonly string[]): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const term of binaryTerms) {
    const ones = [...term].filter((bit) => bit === "1").length;
    const group = groups.get(ones) ?? [];
    group.push(term);
    groups.set(ones, group);
  }
  return groups;
}

/** Direct TypeScript port of combine_terms from the reference notebook. */
export function combineTerms(first: string, second: string): [boolean, string] {
  let differences = 0;
  let combined = "";
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] === second[index]) {
      combined += first[index];
    } else {
      differences += 1;
      combined += "-";
      if (differences > 1) return [false, ""];
    }
  }
  return [differences === 1, combined];
}

export function combineGroups(groups: Map<number, string[]>): {
  newGroups: Map<number, string[]>;
  primePatterns: Set<string>;
} {
  const newGroups = new Map<number, string[]>();
  const usedTerms = new Set<string>();
  const primePatterns = new Set<string>();
  const keys = [...groups.keys()].sort((left, right) => left - right);

  for (let index = 0; index < keys.length - 1; index += 1) {
    const current = groups.get(keys[index]) ?? [];
    const next = groups.get(keys[index + 1]) ?? [];
    for (const first of current) {
      for (const second of next) {
        const [success, combined] = combineTerms(first, second);
        if (!success) continue;
        usedTerms.add(first);
        usedTerms.add(second);
        const ones = [...combined].filter((bit) => bit === "1").length;
        const terms = newGroups.get(ones) ?? [];
        if (!terms.includes(combined)) terms.push(combined);
        newGroups.set(ones, terms);
      }
    }
  }

  for (const terms of groups.values()) {
    for (const term of terms) {
      if (!usedTerms.has(term)) primePatterns.add(term);
    }
  }
  return { newGroups, primePatterns };
}

/** Faithful TypeScript port of find_prime_implicants from the reference notebook. */
export function findPrimePatterns(input: NormalizedRequest): string[] {
  if (input.minterms.length === 0) return [];
  const allTerms = [...new Set([...input.minterms, ...input.dontCares])].sort((a, b) => a - b);
  let groups = groupMinterms(decimalToBinary(allTerms, input.variableCount));
  const primePatterns = new Set<string>();

  while (true) {
    const { newGroups, primePatterns: discovered } = combineGroups(groups);
    discovered.forEach((term) => primePatterns.add(term));
    if (newGroups.size === 0) break;
    groups = newGroups;
  }

  return [...primePatterns].sort();
}

export function implicantCovers(implicant: string, mintermBits: string): boolean {
  return [...implicant].every((bit, index) => bit === "-" || bit === mintermBits[index]);
}

/** Faithful structured equivalent of build_prime_chart from the reference notebook. */
export function buildPrimeChart(
  patterns: readonly string[],
  minterms: readonly number[],
  variableCount: number,
): PrimeChartEntry[] {
  const binaries = decimalToBinary(minterms, variableCount);
  return minterms.map((minterm, index) => ({
    minterm,
    implicants: patterns.filter((pattern) => implicantCovers(pattern, binaries[index])),
  }));
}

export function findEssentialPatterns(chart: readonly PrimeChartEntry[]): string[] {
  return [...new Set(chart.filter((entry) => entry.implicants.length === 1).map((entry) => entry.implicants[0]))].sort();
}

/** Faithful TypeScript port of remove_covered_minterms from the reference notebook. */
export function removeCoveredMinterms(
  chart: readonly PrimeChartEntry[],
  essentials: readonly string[],
): PrimeChartEntry[] {
  return chart.filter((entry) => !entry.implicants.some((implicant) => essentials.includes(implicant)));
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (size > items.length) return [];
  const result: T[][] = [];
  const select = (start: number, chosen: T[]) => {
    if (chosen.length === size) {
      result.push([...chosen]);
      return;
    }
    for (let index = start; index <= items.length - (size - chosen.length); index += 1) {
      chosen.push(items[index]);
      select(index + 1, chosen);
      chosen.pop();
    }
  };
  select(0, []);
  return result;
}

/**
 * Faithful exhaustive subset search equivalent to find_all_covers(). It does
 * not substitute Petrick's method or collapse alternatives: all valid covers
 * are kept so minimumCovers can retain every minimum-size result.
 */
export function findAllCovers(reducedChart: readonly PrimeChartEntry[]): string[][] {
  if (reducedChart.length === 0) return [[]];
  const implicants = [...new Set(reducedChart.flatMap((entry) => entry.implicants))].sort();
  const validCovers: string[][] = [];
  for (let size = 1; size <= implicants.length; size += 1) {
    for (const subset of combinations(implicants, size)) {
      if (reducedChart.every((entry) => subset.some((implicant) => entry.implicants.includes(implicant)))) {
        validCovers.push(subset);
      }
    }
  }
  return validCovers;
}

export function minimumCovers(covers: readonly string[][]): string[][] {
  if (covers.length === 0) return [];
  const minimumSize = Math.min(...covers.map((cover) => cover.length));
  return covers.filter((cover) => cover.length === minimumSize).map((cover) => [...cover]);
}

export function implicantToExpression(pattern: string, variables: readonly string[]): string {
  const literalTokens = [...pattern].flatMap((bit, index) => {
    if (bit === "-") return [];
    return [bit === "1" ? variables[index] : `${variables[index]}'`];
  });
  if (literalTokens.length === 0) return "1";
  const needsExplicitAnd = variables.some((variable) => variable.length > 1);
  return literalTokens.join(needsExplicitAnd ? " * " : "");
}

export function solutionToExpression(
  essentialPatterns: readonly string[],
  additionalPatterns: readonly string[],
  variables: readonly string[],
): string {
  const patterns = [...essentialPatterns].sort().concat(additionalPatterns);
  return patterns.length === 0 ? "0" : patterns.map((pattern) => implicantToExpression(pattern, variables)).join(" + ");
}

export function describeImplicant(pattern: string, input: NormalizedRequest): Implicant {
  const mintermBits = decimalToBinary(input.minterms, input.variableCount);
  return {
    pattern,
    expression: implicantToExpression(pattern, input.variables),
    coveredMinterms: input.minterms.filter((_, index) => implicantCovers(pattern, mintermBits[index])),
  };
}

export function minimize(input: NormalizedRequest): MinimizationDetails {
  const primePatterns = findPrimePatterns(input);
  const primeChart = buildPrimeChart(primePatterns, input.minterms, input.variableCount);
  const essentialPatterns = findEssentialPatterns(primeChart);
  const reducedPrimeChart = removeCoveredMinterms(primeChart, essentialPatterns);
  const allValidAdditionalCovers = findAllCovers(reducedPrimeChart);
  const minimumAdditionalCovers = minimumCovers(allValidAdditionalCovers);
  return {
    primePatterns,
    primeChart,
    essentialPatterns,
    reducedPrimeChart,
    allValidAdditionalCovers,
    minimumAdditionalCovers,
  };
}
