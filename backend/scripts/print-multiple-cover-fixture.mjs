import { analyzeBooleanFunction } from "../dist/api/analyze.js";

const fixture = {
  inputType: "minterms",
  variables: ["A", "B", "C", "D"],
  minterms: [0, 1, 2, 5, 6, 7, 8, 9, 10, 13, 14, 15],
  dontCares: [],
};

const result = analyzeBooleanFunction(fixture);
console.log(JSON.stringify({
  fixture,
  essentialPrimeImplicants: result.essentialPrimeImplicants,
  allValidAdditionalCovers: result.allValidAdditionalCovers,
  minimumSolutions: result.minimumSolutions.map((solution) => ({
    expression: solution.expression,
    implicants: solution.implicants,
    additionalImplicants: solution.additionalImplicants,
    nandVerified: solution.nand.verification.passed,
    norVerified: solution.nor.verification.passed,
  })),
}, null, 2));
