# Backend Audit — From Notebook to FastAPI Backend

**Author:** Manus AI · **Date:** August 17, 2026

## 1. What was audited

The reference notebook (`bare_code.ipynb`) implements the classic
Quine–McCluskey workflow for Boolean-function minimization. The table below
summarizes each stage found in the notebook and how it was handled in the
conversion.

| Notebook stage | Implementation in the notebook | Action taken |
|---|---|---|
| Truth table | Generated row-by-row from minterms; `X` for don't-cares | Preserved verbatim (`generate_truth_table`) |
| K-map | Gray-code ordering, split into row/column variable groups | Preserved verbatim (`generate_kmap`) |
| Prime implicants | Adjacency-combination loop over the minterm/don't-care set | Preserved verbatim (`find_prime_implicants`) |
| Prime chart | Implicant → minterm coverage dict | Preserved verbatim (`build_prime_chart`) |
| Essential prime implicants | Columns covered exactly once | Preserved verbatim (`find_essential_prime_implicants`) |
| Reduced chart + all covers | Brute-force subset enumeration, filtered to minimum covers | Preserved verbatim (`remove_covered_minterms`, `find_all_covers`, `minimum_covers`) |
| SOP formatting | Bit-string (`-`/`0`/`1`) → literal expression | Preserved verbatim |
| Interactive input cell | `input()` prompts + `print()` output | Replaced by a programmatic orchestrator (`generate_analysis`) |

Nothing in the algorithmic core was rewritten. A single thin, documented
wrapper (`generate_analysis`) converts maxterm inputs into the equivalent
minterm set and then runs the preserved pipeline in order, returning a
structured dictionary instead of printing to the console.

## 2. Capabilities of the notebook

The notebook covers minterm input, don't-care minimization, multiple
minimum covers, and K-map visualization in the console. It does **not**
implement maxterm input, NAND/NOR conversion, circuit drawing, or any HTTP
interface. Those gaps are exactly what the new backend adds, in this order:

1. **Maxterm / `both` input types** — a thin conversion layer over the
   existing minterm pipeline, with validation that minterms and maxterms
   never overlap.
2. **NAND–NAND conversion** — double negation of the SOP; every product
   term becomes a NAND gate with inverted inputs for complemented
   literals, and a final NAND combines the term outputs.
3. **NOR–NOR conversion** — the zeros of the minimized SOP define the
   maxterms (sums) of the POS; each sum is implemented as a NOR gate, and
   a final NOR implements the AND of sums. A constant-1 function (no
   zeros) is a dedicated special case.
4. **Schemdraw rendering** — three gate-level diagrams (SOP, NAND, NOR)
   with input labels, complemented-input inverters, and a labeled `F`
   output. Images are PNG bytes returned in the API response and also
   persisted for later retrieval.
5. **FastAPI HTTP layer** — request validation, CORS, structured errors,
   and image endpoints, per the specification.

## 3. Bugs found and fixed during the conversion

Two latent defects in the notebook-derived logic were discovered by the
logical-equivalence tests and corrected, with the corrected behavior
verified against the truth table on every reference case.

**NOR inversion mapping.** The original sum construction inverted the
literal whenever the zero's bit was `0`. For the zero `A=0,B=0` (sum
`A + B`) this produced the NOR gate `NOR(A', B') = A·B` instead of
`NOR(A, B) = A'·B'`, and the resulting network implemented `¬F` rather
than `F`. The mapping was corrected to invert exactly the complemented
literals (bit `1`), after which every NOR–NOR network in the test suite
matches the truth table on all care rows.

**Image URL prefix.** The saved-image helper initially returned
`/circuits/...` while the router lives under the `/api` prefix, causing
`404` responses from the image endpoint. Fixed by returning
`/api/circuits/{id}/{variant}`.

Two defensive constraints were also added, neither of which changes
correct behavior:

- **Variable names** are restricted to single uppercase letters A–Z,
  because the SOP tokenizer and expression evaluator in the preserved
  core assume single-character names.
- **Term-list disjointness** is enforced (no index may appear in both
  minterms and don't-cares, etc.) before the pipeline runs.

## 4. Quality evidence

`pytest tests/` executes ten tests and all pass:

| Test | Verifies |
|---|---|
| `test_reference_cases` | Notebook ground-truth examples return the expected minimized expressions; image endpoints serve PNGs |
| `test_sop_equivalence` | The primary SOP evaluates to the truth table |
| `test_nand_nor_equivalence` | NAND–NAND and NOR–NOR networks match the truth table on care rows |
| `test_maxterm_input` | `ΠM(0,2) ≡ Σm(1,3) = B` |
| `test_dont_cares` | Minimization and network equivalence with don't-cares |
| `test_validation_errors` | Twelve structured `422` error cases |
| `test_response_structure` | All payload fields present; image URLs correct |
| `test_unknown_circuit_variant` | `404` for unknown variants |
| `test_health` | Liveness probe |
| `test_kmap_shape` | 4-variable K-map split and dimensions |

Live-server checks additionally confirmed CORS preflight headers for the
configured Vite/React development origins.

## 5. Limitations

The engine is limited to 2–6 variables (K-map splitting requires an even
grouping and cover enumeration stays tractable only in that range), and
variable names are single uppercase letters A–Z. Beyond six variables the
API returns `INVALID_VARIABLE_COUNT`. These are documented constraints,
not implementation gaps.
