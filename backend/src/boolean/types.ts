export type InputType = "minterms" | "maxterms";
export type CellValue = 0 | 1 | "X";

export type AnalyzeRequest =
  | {
      /** Defaults to minterms when omitted for compatibility with existing callers. */
      inputType?: "minterms";
      variables: string[];
      minterms: number[];
      dontCares?: number[];
    }
  | {
      inputType: "maxterms";
      variables: string[];
      maxterms: number[];
      dontCares?: number[];
    };

/**
 * Internal on-set representation consumed by the reference-compatible
 * minimizer. For maxterm input, minterms are derived from the complement of
 * maxterms and don't-care terms within the complete input space.
 */
export interface NormalizedRequest {
  inputType: InputType;
  variables: string[];
  minterms: number[];
  specifiedTerms: number[];
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
