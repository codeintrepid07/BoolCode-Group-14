import assert from "node:assert/strict";
import { createApp } from "../dist/server.js";

const app = createApp();
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
const address = server.address();
assert.ok(address && typeof address !== "string", "Test server did not expose a TCP address.");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variables: ["A", "B", "C"], minterms: [0, 2, 3, 6, 7], dontCares: [] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.minimumSolutions.map((solution) => solution.expression), ["B + A'C'"]);
  assert.ok(result.minimumSolutions[0].nand.gateDag);
  assert.equal("gateTree" in result.minimumSolutions[0].nand, false);
  assert.equal(result.minimumSolutions[0].nand.verification.passed, true);
  assert.equal(result.minimumSolutions[0].nor.verification.passed, true);

  const sharingResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variables: ["A", "B", "C"], minterms: [1, 2, 3], dontCares: [] }),
  });
  assert.equal(sharingResponse.status, 200);
  const sharingResult = await sharingResponse.json();
  const links = sharingResult.minimumSolutions[0].nand.graph.links;
  assert.ok(
    [...new Set(links.map((link) => link.source))].some(
      (source) => new Set(links.filter((link) => link.source === source).map((link) => link.target)).size > 1,
    ),
    "The public NAND graph must expose shared-source fan-out.",
  );

  const fourVariableResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      variables: ["A", "B", "C", "D"],
      minterms: [0, 1, 2, 5, 6, 7, 8, 9, 10, 13, 14, 15],
      dontCares: [],
    }),
  });
  assert.equal(fourVariableResponse.status, 200);
  const fourVariableResult = await fourVariableResponse.json();
  assert.deepEqual(
    fourVariableResult.minimumSolutions.map((solution) => solution.expression),
    ["C'D + B'D' + BC", "CD' + B'C' + BD"],
  );
  assert.ok(fourVariableResult.minimumSolutions.every((solution) => solution.nand.verification.passed && solution.nor.verification.passed));

  const dontCareResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variables: ["A", "B", "C"], minterms: [1, 3, 7], dontCares: [5] }),
  });
  assert.equal(dontCareResponse.status, 200);
  const dontCareResult = await dontCareResponse.json();
  assert.deepEqual(dontCareResult.input.dontCares, [5]);
  assert.deepEqual(dontCareResult.minimumSolutions.map((solution) => solution.expression), ["C"]);
  assert.equal(dontCareResult.minimumSolutions[0].nand.verification.passed, true);
  assert.equal(dontCareResult.minimumSolutions[0].nor.verification.passed, true);

  const invalid = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variables: ["A"], minterms: [2] }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "INVALID_MINTERM");
  console.log("API smoke test passed.");
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
