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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectStatementsAndCommentsFromCSV = collectStatementsAndCommentsFromCSV;
exports.generateEvaluationReport = generateEvaluationReport;
// Utility functions and types for automated evaluation of summarization results using LLMs.
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
/**
 * Reads statements and comments from a CSV file and returns them as an array of StatementWithComments objects.
 *
 * The CSV file is expected to have columns for 'summary' and 'comments'.
 *
 * @param csvFilePath The path to the CSV file.
 * @returns An array of StatementWithComments objects.
 * @throws Error if the CSV file cannot be read or parsed.
 */
function collectStatementsAndCommentsFromCSV(csvFilePath) {
    const statementsAndComments = [];
    try {
        const csvFileContent = fs_1.default.readFileSync(csvFilePath, "utf8");
        const csvRecords = (0, sync_1.parse)(csvFileContent, {
            columns: true,
            skip_empty_lines: true,
        });
        for (const record of csvRecords) {
            statementsAndComments.push({
                statement: record.summary,
                comments: record.comments,
            });
        }
    }
    catch (error) {
        console.error("Failed to read the input file:", error);
    }
    return statementsAndComments;
}
/**
 * Generates a summary evaluation report based on aggregated autorating results.
 * @param results Aggregated results from the autorating process.
 * @param totalRuntimeMin Total runtime of the evaluation in minutes.
 * @returns A formatted report string.
 */
function generateEvaluationReport(results, totalRuntimeMin) {
    let report = "Summary Evaluation Report\n\n";
    report += `Total statements: ${results.totalStatements}\n\n`;
    for (const question in results.questions) {
        const counts = results.questions[question];
        const totalAnswers = counts.pass + counts.fail + counts.unsure;
        report += `${question}\n`;
        report += `Pass: ${((counts.pass / totalAnswers) * 100).toFixed(0)}% (${counts.pass}/${totalAnswers})\n`;
        report += `Fail: ${((counts.fail / totalAnswers) * 100).toFixed(0)}% (${counts.fail}/${totalAnswers})\n`;
        report += `Unsure: ${((counts.unsure / totalAnswers) * 100).toFixed(0)}% (${counts.unsure}/${totalAnswers})\n`;
        report += "\n"; // Add a newline for better readability
    }
    report += `Total runtime: ${totalRuntimeMin.toFixed(2)} minutes\n`;
    return report;
}
