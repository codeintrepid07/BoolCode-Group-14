const imageInput = document.getElementById("circuit-image");
const analyzeButton = document.getElementById("analyze-button");
const status = document.getElementById("status");

const resultsSection =
    document.getElementById("results-section");

const imagePreviewContainer =
    document.getElementById("image-preview-container");

const imagePreview =
    document.getElementById("image-preview");

const booleanResult =
    document.getElementById("boolean-result");

const truthTableResult =
    document.getElementById("truth-table-result");

const kmapResult =
    document.getElementById("kmap-result");

const gateResult =
    document.getElementById("gate-result");

const verilogResult =
    document.getElementById("verilog-result");


imageInput.addEventListener("change", showImagePreview);
analyzeButton.addEventListener("click", analyzeCircuit);


function showImagePreview() {

    const file = imageInput.files[0];

    if (!file) {
        imagePreviewContainer.style.display = "none";
        return;
    }

    const imageURL = URL.createObjectURL(file);

    imagePreview.src = imageURL;
    imagePreviewContainer.style.display = "block";

    status.textContent = "Image selected.";
}


async function analyzeCircuit() {

    status.textContent = "Connecting to backend...";
    analyzeButton.disabled = true;

    // Test input for the backend
    const requestData = {
        inputType: "minterms",
        variables: ["A", "B", "C"],
        minterms: [0, 2, 3, 6, 7],
        dontCares: []
    };

    try {

        const response = await fetch(
            "http://localhost:3001/api/analyze",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error?.message ||
                "Backend returned an error."
            );
        }

        console.log("Backend response:", result);

        displayResults(result);

        status.textContent = "Analysis complete.";
        resultsSection.hidden = false;

    } catch (error) {

        console.error(error);

        status.textContent =
            "Could not connect to the backend: " +
            error.message;

    } finally {

        analyzeButton.disabled = false;

    }
}


function displayResults(result) {

    if (result.minimumSolutions &&
        result.minimumSolutions.length > 0) {

        booleanResult.textContent =
            result.minimumSolutions[0].expression;

    } else {

        booleanResult.textContent =
            "No minimum solution returned.";

    }

    displayTruthTable(result.truthTable);
    displayKMap(result.kmap);

    if (result.minimumSolutions &&
        result.minimumSolutions.length > 0) {

        const solution =
            result.minimumSolutions[0];

        gateResult.textContent =
            JSON.stringify(
                {
                    nand: solution.nand,
                    nor: solution.nor
                },
                null,
                2
            );

    } else {

        gateResult.textContent =
            "No gate implementation returned.";

    }

    // Verilog is not currently returned by the backend
    verilogResult.textContent =
        "Verilog generation is not currently provided by the backend API.";
}


function displayTruthTable(truthTable) {

    if (!truthTable || !truthTable.rows) {
        truthTableResult.textContent =
            "No truth table returned.";
        return;
    }

    const variables = truthTable.variables;

    let html = "<table><tr>";

    variables.forEach(variable => {
        html += `<th>${variable}</th>`;
    });

    html += "<th>Y</th></tr>";

    truthTable.rows.forEach(row => {

        html += "<tr>";

        row.inputs.forEach(value => {
            html += `<td>${value}</td>`;
        });

        html += `<td>${row.output}</td>`;
        html += "</tr>";
    });

    html += "</table>";

    truthTableResult.innerHTML = html;
}

function displayKMap(kmap) {

    if (!kmap) {
        kmapResult.textContent =
            "No K-map returned.";
        return;
    }

    kmapResult.textContent =
        JSON.stringify(kmap, null, 2);
}