"use strict";
// Copyright 2024 Google LLC
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
// Rerun summarize 5x using a CSV file as input and outputting the summaries to another CSV.
// Run like:
// npx ts-node ./evaluations/rerunner.ts --outputFile "data1.csv" \
// --vertexProject "<your project name here>" \
// --inputFile "/usr/local/google/home/achvasta/Downloads/comments-with-vote-tallies.csv"
// --rerunCount 3
const commander_1 = require("commander");
const csv_writer_1 = require("csv-writer");
const runner_utils_1 = require("./runner_utils");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Parse command line arguments.
        const program = new commander_1.Command();
        program
            .option("-o, --outputFile <file>", "The output file name.")
            .option("-i, --inputFile <file>", "The input file name.")
            .option("-r, --rerunCount <count>", "The number of times to rerun.")
            .option("-v, --vertexProject <project>", "The Vertex Project name.");
        program.parse(process.argv);
        const options = program.opts();
        const comments = yield (0, runner_utils_1.getCommentsFromCsv)(options.inputFile);
        let outputTexts = [];
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: options.outputFile,
            header: ["run", "summaryType", "text"],
        });
        for (let i = 0; i < options.rerunCount; i++) {
            const summary = yield (0, runner_utils_1.getSummary)(options.vertexProject, comments);
            outputTexts = outputTexts.concat([
                {
                    run: i,
                    summaryType: "VoteTally",
                    text: summary.getText("MARKDOWN"),
                },
            ]);
        }
        csvWriter.writeRecords(outputTexts).then(() => console.log("CSV file written successfully."));
    });
}
main();
