export type CellValue = 0 | 1 | "X";

export interface AnalyzeRequest {
  /** The notebook supports sum-of-products minterm input only. */
  inputType?: "minterms";
  variables: string[];
  minterms: number[];
  dontCares?: number[];
}

export interface NormalizedRequest {
  variables: string[];
  minterms: number[];
  dontCares: number[];
  variableCount: number;
}

export interface TruthTableRow {
  minterm: number;
  inputs: number[];
  output: CellValue;
}

export interface TruthTable {
  variables: string[];
  rows: TruthTableRow[];
}

export interface KmapCell {
  rowCode: string;
  columnCode: string;
  minterm: number;
  value: CellValue;
}

export interface Kmap {
  rowVariables: string[];
  columnVariables: string[];
  rowGrayCode: string[];
  columnGrayCode: string[];
  cells: KmapCell[][];
}

export interface Implicant {
  pattern: string;
  expression: string;
  coveredMinterms: number[];
}

export interface PrimeChartEntry {
  minterm: number;
  implicants: string[];
}
