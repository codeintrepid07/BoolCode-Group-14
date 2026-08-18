import { analyzeBooleanFunction } from "../dist/api/analyze.js";

const fixture = {
  inputType: "maxterms",
  variables: ["A", "B", "C"],
  maxterms: [0, 1, 2, 4],
  dontCares: [],
};

const result = analyzeBooleanFunction(fixture);
console.log(JSON.stringify({
  input: result.input,
  primeImplicants: result.primeImplicants,
  minimumSolutions: result.minimumSolutions.map((solution) => ({
    expression: solution.expression,
    implicants: solution.implicants,
    nandVerified: solution.nand.verification.passed,
    norVerified: solution.nor.verification.passed,
  })),
}, null, 2));
