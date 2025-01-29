"use strict";
// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// Module for automated evaluation of summarization results using LLMs.
// Command to run hallucination evals:
// npx ts-node evals/autorating/run_autoraters.ts -p <your-gcp-project> -l <gcp-project-location> -m <vertex-model-name> -i <path-to-your-input-csv> -o <output-directory>
// Examples:
// 1. Specifying all flags:
// npx ts-node evals/autorating/run_autoraters.ts -p your-project-id -l europe-west4 -m gemini-2.0-flash-exp -i evals/summary.csv -o evals/hallucination_results
// 2. Using all default flag values:
// npx ts-node evals/autorating/run_autoraters.ts -p your-project-id -i evals/summary.csv
// Example of input data:
// +------------------------+---------------------+
// | summary                | comments            | <- "summary" and "comments" columns are required
// +------------------------+---------------------+
// | A summary statement... | A source comment... |
// +------------------------+---------------------+
const commander_1 = require("commander");
const hallucination_autorater_1 = require("./hallucination_autorater");
const autorating_utils_1 = require("./autorating_utils");
const vertex_model_1 = require("../../src/models/vertex_model");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const program = new commander_1.Command();
        program
            .requiredOption("-p, --gcpProject <project>", "GCP project name for Vertex AI")
            .requiredOption("-i, --inputFile <file>", "Path to the CSV file with summary statements and comments")
            .option("-o, --outputDir <directory>", "Directory to save evaluation results to", "evals/hallucination_results")
            .option("-l, --location <location>", "Location for Vertex AI GCP project", "us-central1")
            .option("-m, --model <model>", "Vertex AI model name", "gemini-1.5-pro-002");
        program.parse(process.argv);
        const options = program.opts();
        const model = new vertex_model_1.VertexModel(options.gcpProject, options.location, options.model);
        const summaries = (0, autorating_utils_1.collectStatementsAndCommentsFromCSV)(options.inputFile);
        yield (0, hallucination_autorater_1.rateHallucination)(model, summaries, options.outputDir);
    });
}
main();
