# Digital Circuits Backend

A production-ready FastAPI backend that turns a Boolean-function specification
(minterms, maxterms, and don't-care conditions) into a complete analysis
package: truth table, Karnaugh map, Quine–McCluskey minimization, and
Schemdraw-rendered two-level circuit diagrams in AND–OR (SOP), NAND–NAND, and
NOR–NOR form.

The boolean-algorithm core is taken directly from the reference notebook
(`bare_code.ipynb`) and preserved bit-for-bit so that results match the
notebook exactly. Everything around it — input validation, the programmatic
orchestrator, the circuit-conversion service, the Schemdraw renderer, and the
HTTP layer — was built to the specification in `pasted_content.txt`.

## Quick start

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # optional; sensible defaults ship with the code
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API is then live at `http://localhost:8000`, with the interactive docs
(`/docs`) and ReDoc (`/redoc`) enabled.

## Example request

```bash
curl -X POST http://localhost:8000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "variables": ["A", "B", "C", "D"],
    "input_type": "minterms",
    "minterms": [1, 3, 5, 7, 9, 11, 13, 15],
    "maxterms": [],
    "dont_cares": []
  }'
```

The response contains the truth table, K-map, prime/essential prime
implicants, all minimum covers, the minimized SOP expression, and URLs for
the three circuit images (`sop`, `nand`, `nor`), each retrievable from
`GET /api/circuits/{analysis_id}/{variant}`.

## Repository layout

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, router mount
│   ├── config.py                  # pydantic-settings (env / .env driven)
│   ├── api/routes.py              # /api/generate, /api/circuits, /api/health
│   ├── schemas/models.py          # Pydantic request/response models
│   ├── services/
│   │   ├── boolean_analysis.py    # Notebook algorithms + orchestrator
│   │   └── circuit_logic.py       # NAND/NOR network construction & evaluation
│   ├── rendering/schemdraw_renderer.py  # SOP / NAND / NOR diagram generation
│   └── utils/validation.py        # Structured input validation
├── tests/test_api.py              # End-to-end + logical-equivalence tests
├── generated/circuits/            # Persisted PNG outputs (auto-created)
├── requirements.txt
└── .env.example
```

## Architecture

The layers are deliberately separated, matching the spec:

```
HTTP routes → input validation → analysis orchestrator
            → notebook Boolean algorithms (untouched)
            → circuit network builders → Schemdraw renderer → PNG bytes
```

Requests are validated before any algorithm runs, with structured
`{"error": {"code": ..., "message": ...}}` responses for semantic problems.
Analysis results are serialized from the same in-memory structures the
notebook prints. Circuit images are generated server-side and served from a
generated directory keyed by a random `analysis_id`, so the frontend never
does image processing of its own.

## Testing

```bash
pytest tests/
```

The suite runs ten tests covering the notebook's reference examples,
SOP/NAND/NOR logical equivalence against the truth table (care terms only
when don't-cares are present), maxterm and don't-care inputs, structured
validation errors, payload shape, and the image endpoint. All tests pass.

## Constraints

| Property | Value |
|---|---|
| Variable count | 2–6 (K-map split, tractable cover search) |
| Variable names | Single uppercase letters A–Z, unique |
| Input types | `minterms`, `maxterms`, `both` |
| Don't-cares | Disjoint from the 1-set and 0-set |

## License / provenance

Algorithms: ported verbatim from the user's `bare_code.ipynb` notebook.
Rest of the code: written for this project.
