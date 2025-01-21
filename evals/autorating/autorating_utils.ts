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

// Utility functions and types for automated evaluation of summarization results using LLMs.

import fs from "fs";
import { parse } from "csv-parse/sync";

/**
 * Represents a statement and its corresponding comments for evaluation.
 */
export interface StatementWithComments {
  /**
   * The summary statement to be evaluated.
   */
  statement: string;
  /**
   * The comments associated with the statement.
   */
  comments: string;
}

/**
 * Represents aggregated results for autorating evaluations.
 */
export interface AutoratingAggregatedResults {
  /**
   * Total number of statements evaluated.
   */
  totalStatements: number;
  /**
   * Evaluation results broken down by question.  Each question maps to pass/fail/unsure counts.
   */
  questions: {
    [question: string]: {
      pass: number;
      fail: number;
      unsure: number;
    };
  };
}

/**
 * Reads statements and comments from a CSV file and returns them as an array of StatementWithComments objects.
 *
 * The CSV file is expected to have columns for 'summary' and 'comments'.
 *
 * @param csvFilePath The path to the CSV file.
 * @returns An array of StatementWithComments objects.
 * @throws Error if the CSV file cannot be read or parsed.
 */
export function collectStatementsAndCommentsFromCSV(csvFilePath: string): StatementWithComments[] {
  const statementsAndComments: StatementWithComments[] = [];
  try {
    const csvFileContent = fs.readFileSync(csvFilePath, "utf8");

    const csvRecords = parse(csvFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    for (const record of csvRecords) {
      statementsAndComments.push({
        statement: record.summary,
        comments: record.comments,
      });
    }
  } catch (error) {
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
export function generateEvaluationReport(
  results: AutoratingAggregatedResults,
  totalRuntimeMin: number
): string {
  let report = "Summary Evaluation Report\n\n";
  report += `Total statements: ${results.totalStatements}\n\n`;
  for (const question in results.questions) {
    const counts = results.questions[question];
    const totalAnswers = counts.pass + counts.fail + counts.unsure;
    report += `${question}\n`;
    report += `Pass: ${((counts.pass / totalAnswers) * 100).toFixed(0)}% (${
      counts.pass
    }/${totalAnswers})\n`;
    report += `Fail: ${((counts.fail / totalAnswers) * 100).toFixed(0)}% (${
      counts.fail
    }/${totalAnswers})\n`;
    report += `Unsure: ${((counts.unsure / totalAnswers) * 100).toFixed(0)}% (${
      counts.unsure
    }/${totalAnswers})\n`;
    report += "\n"; // Add a newline for better readability
  }
  report += `Total runtime: ${totalRuntimeMin.toFixed(2)} minutes\n`;
  return report;
}
