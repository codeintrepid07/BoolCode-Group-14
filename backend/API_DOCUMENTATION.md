# API Documentation — Digital Circuits Backend

**Base URL:** `http://localhost:8000/api`

**OpenAPI docs:** `/docs` (Swagger UI) · `/redoc` (ReDoc)

The backend consumes a Boolean-function specification over named variables
and returns a complete analysis package together with three server-rendered
two-level circuit diagrams (AND–OR, NAND–NAND, NOR–NOR). All logic runs
server-side; the frontend only displays the returned JSON and the generated
PNG images.

## Endpoints at a glance

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/generate` | Full analysis pipeline + circuit rendering |
| `GET` | `/api/circuits/{analysis_id}/{variant}` | Download a rendered circuit image |
| `GET` | `/api/health` | Liveness probe |

---

## 1. `POST /api/generate`

Run the full pipeline: validate, build the truth table, draw the K-map,
minimize with Quine–McCluskey, and render the three circuit variants.

### Request body

```json
{
  "variables": ["A", "B", "C", "D"],
  "input_type": "minterms",
  "minterms": [1, 3, 5, 7],
  "maxterms": [],
  "dont_cares": []
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `variables` | `string[]` | yes | 2–6 unique single uppercase letters (A–Z), MSB-first order |
| `input_type` | `string` | no (default `minterms`) | one of `minterms`, `maxterms`, `both` |
| `minterms` | `int[]` | no | indices where F = 1; required when `input_type ∈ {minterms, both}` |
| `maxterms` | `int[]` | no | indices where F = 0; required when `input_type ∈ {maxterms, both}` |
| `dont_cares` | `int[]` | no | indices where F may be 0 or 1; must not overlap minterms or maxterms |

Term indices must lie in `[0, 2^n − 1]` where `n = |variables|`, and the
three term sets must be pairwise disjoint. `input_type = "both"` requires
*both* `minterms` and `maxterms` and forbids overlap between them.

### Success response (`200 OK`)

```json
{
  "success": true,
  "analysis_id": "e8dc3cc891dfc11a",
  "variables": ["A", "B"],
  "truth_table": {
    "variables": ["A", "B"],
    "rows": [
      {"inputs": [0, 0], "output": 0},
      {"inputs": [0, 1], "output": 1},
      {"inputs": [1, 0], "output": 0},
      {"inputs": [1, 1], "output": 1}
    ]
  },
  "kmap": {
    "row_variables": ["A"],
    "column_variables": ["B"],
    "row_order": ["0", "1"],
    "column_order": ["0", "1"],
    "cells": [["0", "1"], ["0", "1"]]
  },
  "minimization": {
    "prime_implicants": ["-1"],
    "essential_prime_implicants": ["-1"],
    "minimum_covers": [["-1"]],
    "expressions": ["B"],
    "primary_expression": "B"
  },
  "circuits": {
    "sop":  {"image_url": "/api/circuits/e8dc3cc891dfc11a/sop",  "filename": "e8dc3cc891dfc11a_sop.png"},
    "nand": {"image_url": "/api/circuits/e8dc3cc891dfc11a/nand", "filename": "e8dc3cc891dfc11a_nand.png"},
    "nor":  {"image_url": "/api/circuits/e8dc3cc891dfc11a/nor",  "filename": "e8dc3cc891dfc11a_nor.png"}
  }
}
```

Field semantics:

| Field | Meaning |
|---|---|
| `analysis_id` | Unique key for the generated circuit images |
| `truth_table` | One row per binary input combination, MSB-first counting; don't-care rows report `"output": "X"` |
| `kmap` | Karnaugh map split into row/column variable groups with Gray-code ordering; `cells` is a 2D list of `"0"`, `"1"`, and `"X"` |
| `minimization.prime_implicants` | Implicants encoded as `-`/`0`/`1` strings in variable order |
| `minimization.essential_prime_implicants` | Implicants covering at least one uncovered minterm |
| `minimization.minimum_covers` | Every minimum cover (list of covers; may contain multiple optima) |
| `minimization.expressions` | Full SOP for every minimum cover |
| `minimization.primary_expression` | The canonical minimized SOP (first expression) — the expression the circuits implement |
| `circuits` | Image URLs and filenames for the three variants |

### Circuit variants

| Variant | Gate structure | Implements |
|---|---|---|
| `sop` | AND gates feeding an OR gate | The minimized SOP directly |
| `nand` | NAND term gates feeding a final NAND | Double-negated SOP (NAND–NAND) |
| `nor` | NOR sum gates feeding a final NOR | POS of the function (NOR–NOR) |

All three networks are provably equivalent to the truth table on care terms
(the test suite verifies this for every reference case).

### Error responses (`422 Unprocessable Entity`)

Semantic validation failures return a structured payload:

```json
{
  "error": {
    "code": "INVALID_INPUT_COMBINATION",
    "message": "Terms cannot be both minterms and maxterms: [3]."
  }
}
```

| Code | Trigger |
|---|---|
| `EMPTY_VARIABLES` | Missing or empty `variables` |
| `INVALID_VARIABLE_COUNT` | Fewer than 2 or more than 6 variables |
| `INVALID_VARIABLE_NAME` | Name is not a single uppercase letter, or contains bad characters |
| `DUPLICATE_VARIABLE` | Same variable twice |
| `UNSUPPORTED_INPUT_TYPE` | `input_type` not in `{minterms, maxterms, both}` |
| `INVALID_MINTERM` / `INVALID_MAXTERM` / `INVALID_DONT_CARE` | Out-of-range or non-integer index |
| `DUPLICATE_MINTERM` / `DUPLICATE_MAXTERM` / `DUPLICATE_DONT_CARE` | Repeated index in a list |
| `INVALID_INPUT_COMBINATION` | Conflicting `input_type` and supplied lists, or minterm/maxterm overlap with `both` |
| `INVALID_DONT_CARE` | Don't-care overlapping the 1-set or 0-set |
| `EMPTY_INPUT` | No minterms and no maxterms supplied |

Malformed JSON or type errors are reported by FastAPI's default validator
with its own `422` body.

---

## 2. `GET /api/circuits/{analysis_id}/{variant}`

Download the PNG for a previously generated circuit. `variant` is one of
`sop`, `nand`, `nor`. Images are persisted under
`generated/circuits/{analysis_id}_{variant}.png` and served as
`image/png`.

| Status | Meaning |
|---|---|
| `200` | PNG body |
| `404` | Unknown variant or no image for this `analysis_id` |

Example:

```bash
curl -O http://localhost:8000/api/circuits/e8dc3cc891dfc11a/nand
```

## 3. `GET /api/health`

```json
{"status": "ok"}
```

## Cross-origin support

CORS is enabled for the origins configured by
`ALLOWED_ORIGINS` (default `http://localhost:5173,http://localhost:3000`,
overrideable via environment or `.env`). Credentials, methods
`GET/POST/OPTIONS`, and all headers are allowed.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `API_HOST` | `0.0.0.0` | Bind address |
| `API_PORT` | `8000` | Bind port |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS origins |
| `GENERATED_IMAGE_DIR` | `<repo>/generated/circuits` | Where rendered PNGs are stored |

## Reference examples (notebook ground truth)

| Variables | Minterms | Expected expression |
|---|---|---|
| A, B | 1, 3 | `B` |
| A, B, C | 1, 3, 5, 7 | `C` |
| A, B, C, D | 1, 3, 5, 7, 9, 11, 13, 15 | `D` |
| A, B, C | 0, 2, 3, 6, 7 | `B + A'C'` |

Don't-care example: `F(A,B,C,D) = Σm(1,3,7,11,15) + d(0,2,5)` minimizes to
`CD + A'D` (an alternative minimum cover is `CD + A'B'`, both returned in
`minimum_covers`).
