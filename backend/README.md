# Digital Circuits Backend

This is the **backend/Boolean-synthesis layer only** for the Digital Circuits application. It accepts a Boolean function expressed as minterms and optional don't-care terms, exposes the complete Boolean analysis through JSON, and compiles **each** minimum Boolean expression into independent 2-input NAND and NOR **shared-expression DAGs**. The frontend remains responsible for presentation and maps the supplied normalized circuit graph to JointJS.

## Architecture

```text
POST /api/analyze
       │
       ▼
Request validation → truth table + Gray-code K-map
       │
       ▼
Quine–McCluskey prime implicants → prime chart → essential PIs
       │
       ▼
Exhaustive reduced-chart subset search (all valid covers retained)
       │
       ▼
Every minimum cover → SOP expression → expression AST
       │                                  │
       ┌──────────────────────────────────┴─────────────────────────────────┐
       ▼                                                                    ▼
2-input NAND compiler                                               2-input NOR compiler
       │                                                                    │
       ▼                                                                    ▼
interned NAND DAG + graph                                          interned NOR DAG + graph
```

## Reference implementation and behavioral fidelity

`bare_code.ipynb` is kept unchanged as the project reference. The TypeScript implementation mirrors its key units: recursive Gray-code generation, minterm-plus-don't-care Quine–McCluskey grouping, chart construction from true minterms only, essential-implicant selection, reduced-chart exhaustive subset search, and minimum-cover filtering.

Critically, the backend never reduces the answer to one arbitrary simplification. `allValidAdditionalCovers` contains every cover found by the reference-style exhaustive search, while `minimumSolutions` contains every equal-size minimum cover and its corresponding expression/circuits.

## Run locally

| Purpose | Command |
|---|---|
| Install dependencies | `npm install` |
| Development server (watches TypeScript) | `npm run dev` |
| Type-check | `npm run check` |
| Build production JavaScript | `npm run build` |
| Start production build | `npm start` |
| Unit tests | `npm test` |
| API smoke test | `npm run test:api` |
| Compare generated TypeScript analysis to the Python oracle | `npm run build && node scripts/compare-reference.mjs` |

The development and production server default to `http://localhost:3001`. Override with `PORT`, such as `PORT=3100 npm start` on a POSIX shell or `$env:PORT=3100; npm start` in PowerShell.

## API

### `POST /api/analyze`

The original notebook only accepts minterms and don't-cares, so the API deliberately supports that same input type. The exhaustive cover search is capped at **six variables** to avoid silently truncating multiple solutions; requests above that limit receive a structured error.

```json
{
  "inputType": "minterms",
  "variables": ["A", "B", "C"],
  "minterms": [0, 2, 3, 6, 7],
  "dontCares": []
}
```

For PowerShell:

```powershell
$body = @{ inputType = "minterms"; variables = @("A", "B", "C"); minterms = @(0, 2, 3, 6, 7); dontCares = @() } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/analyze -ContentType "application/json" -Body $body
```

The response includes the following high-level fields.

| Field | Purpose |
|---|---|
| `truthTable` | Ordered rows with binary input values, minterm index, and `0`, `1`, or `"X"` output. |
| `kmap` | Row/column variable split, Gray-code labels, and fully located cells. |
| `primeImplicants` | All PIs with pattern, Boolean product term, and covered true minterms. |
| `essentialPrimeImplicants` / `nonEssentialPrimeImplicants` | PI categorization maintained for the frontend. |
| `primeImplicantChart` / `reducedPrimeImplicantChart` | Minterm-to-implicant coverage before and after essential PIs. |
| `allValidAdditionalCovers` | Every valid subset found by exhaustive reduced-chart cover search. |
| `minimumSolutions` | Every minimum additional cover, its expression, NAND DAG, and NOR DAG. |

Each `minimumSolutions[]` entry contains this essential shape:

```json
{
  "additionalImplicants": ["..."],
  "implicants": ["..."],
  "expression": "...",
  "nand": {
    "gateDag": {
      "nodes": [
        { "id": "g0", "type": "INPUT", "name": "A" },
        { "id": "g1", "type": "NAND", "inputs": ["g0", "g0"] }
      ],
      "outputNodeId": "g1"
    },
    "graph": {
      "nodes": [
        { "id": "g0", "type": "INPUT", "label": "A" },
        { "id": "g1", "type": "NAND", "label": "NAND" }
      ],
      "links": [
        { "source": "g0", "target": "g1", "targetPort": "in1" },
        { "source": "g0", "target": "g1", "targetPort": "in2" }
      ],
      "outputNodeId": "g1"
    },
    "verification": { "passed": true, "checkedCombinations": 8, "mismatches": [] }
  },
  "nor": { "gateDag": {}, "graph": {}, "verification": {} }
}
```

## Shared-expression DAG contract

`gateDag` is the circuit source of truth. Its nodes are defined once and all gate inputs are **node IDs**, not nested child objects. A source node may therefore have multiple outgoing links. This is intentional fan-out, not duplicated construction. For example, compiling `A'B + A'C` creates the inversion of `A` once; the same node ID is referenced by the two downstream product-term implementations.

Every non-input node is either `NAND` or `NOR` and contains exactly two input IDs. The compiler interns inputs and structurally identical same-kind gate expressions, with a canonical input ordering because NAND and NOR are commutative. The resulting directed graph is checked for missing references and cycles before it is returned. `graph` is a direct renderer adapter: it emits each DAG node exactly once and emits an edge for each input port, allowing JointJS to render genuine shared wires and fan-out. Neither `graph` nor JointJS parses Boolean expressions or performs Boolean logic.

## Safety and error model

All normal API errors follow this shape, without internal stack traces:

```json
{
  "error": {
    "code": "INVALID_MINTERM",
    "message": "minterms must contain integer indices from 0 through 7.",
    "details": { "received": [8], "limit": 8 }
  }
}
```

Supported error codes include malformed requests, invalid variables/terms, overlapping minterms and don't-cares, unsupported input types or variable counts, parser failures, compilation failures, and circuit-generation failures.

## Verification strategy

The test suite asserts notebook-equivalent behavior for the supplied demonstration case, validates a multiple-minimum-cover fixture, verifies universal-gate DAG equivalence for every input combination, and confirms that a repeated subexpression produces a single node with multiple downstream targets. `scripts/reference_oracle.py` executes the actual non-interactive function cells from `bare_code.ipynb`, excluding only its final interactive input cell. `scripts/compare-reference.mjs` runs that reference implementation on multiple functions and compares truth tables, K-maps, prime implicants, charts, essential PIs, all covers, minimum covers, expressions, and per-solution circuit equivalence against TypeScript.
