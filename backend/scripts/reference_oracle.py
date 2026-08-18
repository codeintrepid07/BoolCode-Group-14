"""Run the actual non-interactive Boolean functions from bare_code.ipynb as an oracle.

The notebook's final cell is deliberately excluded because it asks for console
input. Every preceding code cell is loaded unchanged, then its own functions
are called with JSON supplied on standard input.
"""

import json
import sys
from pathlib import Path


def load_reference_functions():
    notebook_path = Path(__file__).resolve().parent.parent / "bare_code.ipynb"
    notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
    namespace = {}
    # The final cell calls get_minterm_input(); all preceding code cells define
    # the exact reference functions needed for analysis.
    for cell in notebook["cells"][:-1]:
        if cell["cell_type"] == "code":
            exec("".join(cell["source"]), namespace)
    return namespace


def analyze(payload):
    reference = load_reference_functions()
    variables = payload["variables"]
    minterms = sorted(set(payload["minterms"]))
    dont_cares = sorted(set(payload.get("dontCares", [])) - set(minterms))
    n = len(variables)

    truth_rows = reference["generate_truth_table"](n, minterms, dont_cares)
    truth_table = [
        {"minterm": index, "inputs": row[:-1], "output": row[-1]}
        for index, row in enumerate(truth_rows)
    ]

    row_gray_code, column_gray_code, kmap_values = reference["generate_kmap"](n, minterms, dont_cares)
    kmap = {
        "rowGrayCode": row_gray_code,
        "columnGrayCode": column_gray_code,
        "cells": [
            [
                {
                    "rowCode": row_code,
                    "columnCode": column_code,
                    "minterm": int(row_code + column_code or "0", 2),
                    "value": value,
                }
                for column_code, value in zip(column_gray_code, row_values)
            ]
            for row_code, row_values in zip(row_gray_code, kmap_values)
        ],
    }

    prime_patterns = reference["find_prime_implicants"](minterms, n, dont_cares)
    chart_dict = reference["build_prime_chart"](prime_patterns, minterms, n)
    prime_chart = [
        {"minterm": minterm, "implicants": implicants}
        for minterm, implicants in chart_dict.items()
    ]
    essential_patterns = sorted(reference["find_essential_prime_implicants"](chart_dict))
    reduced_chart_dict = reference["remove_covered_minterms"](chart_dict, set(essential_patterns))
    reduced_prime_chart = [
        {"minterm": minterm, "implicants": implicants}
        for minterm, implicants in reduced_chart_dict.items()
    ]
    all_valid_additional_covers = reference["find_all_covers"](reduced_chart_dict)
    minimum_additional_covers = reference["minimum_covers"](all_valid_additional_covers)
    expressions = [
        reference["solution_to_expression"](set(essential_patterns), cover, variables)
        for cover in minimum_additional_covers
    ]

    return {
        "truthTable": truth_table,
        "kmap": kmap,
        "primePatterns": prime_patterns,
        "primeChart": prime_chart,
        "essentialPatterns": essential_patterns,
        "reducedPrimeChart": reduced_prime_chart,
        "allValidAdditionalCovers": all_valid_additional_covers,
        "minimumAdditionalCovers": minimum_additional_covers,
        "expressions": expressions,
    }


if __name__ == "__main__":
    print(json.dumps(analyze(json.load(sys.stdin))))
