import type { CellValue, NormalizedRequest, TruthTable } from "./types";

export function mintermToBits(minterm: number, variableCount: number): number[] {
  return minterm
    .toString(2)
    .padStart(variableCount, "0")
    .split("")
    .map((bit) => Number(bit));
}

export function cellValue(minterm: number, minterms: readonly number[], dontCares: readonly number[]): CellValue {
  if (minterms.includes(minterm)) return 1;
  if (dontCares.includes(minterm)) return "X";
  return 0;
}

/** Faithful structured equivalent of generate_truth_table in bare_code.ipynb. */
export function generateTruthTable(input: NormalizedRequest): TruthTable {
  const rows = Array.from({ length: 2 ** input.variableCount }, (_, minterm) => ({
    minterm,
    inputs: mintermToBits(minterm, input.variableCount),
    output: cellValue(minterm, input.minterms, input.dontCares),
  }));
  return { variables: input.variables, rows };
}
