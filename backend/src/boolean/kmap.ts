import { cellValue } from "./truthTable";
import type { Kmap, NormalizedRequest } from "./types";

/** Direct TypeScript port of the notebook's recursive generate_gray_code(). */
export function generateGrayCode(bits: number): string[] {
  if (bits === 0) return [""];
  if (bits === 1) return ["0", "1"];
  const previous = generateGrayCode(bits - 1);
  return [
    ...previous.map((code) => `0${code}`),
    ...[...previous].reverse().map((code) => `1${code}`),
  ];
}

/** Faithful structured equivalent of generate_kmap in bare_code.ipynb. */
export function generateKmap(input: NormalizedRequest): Kmap {
  const rowBitCount = Math.floor(input.variableCount / 2);
  const columnBitCount = input.variableCount - rowBitCount;
  const rowGrayCode = generateGrayCode(rowBitCount);
  const columnGrayCode = generateGrayCode(columnBitCount);

  const cells = rowGrayCode.map((rowCode) =>
    columnGrayCode.map((columnCode) => {
      const binary = `${rowCode}${columnCode}`;
      const minterm = Number.parseInt(binary || "0", 2);
      return {
        rowCode,
        columnCode,
        minterm,
        value: cellValue(minterm, input.minterms, input.dontCares),
      };
    }),
  );

  return {
    rowVariables: input.variables.slice(0, rowBitCount),
    columnVariables: input.variables.slice(rowBitCount),
    rowGrayCode,
    columnGrayCode,
    cells,
  };
}
