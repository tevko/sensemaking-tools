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

import {
  AutoratingAggregatedResults,
  generateEvaluationReport,
  collectStatementsAndCommentsFromCSV,
} from "./autorating_utils";
import fs from "fs";

describe("Autorating Utils", () => {
  describe("collectStatementsAndCommentsFromCSV", () => {
    it("should read statements and comments from a CSV file", () => {
      const csvFilePath = "test_autorating.csv"; // Create a dummy CSV file for testing
      const csvContent =
        '"summary","comments","has_hallucination"\n"statement 1","comment 1",1\n"statement 2","comment 2",0';
      fs.writeFileSync(csvFilePath, csvContent); // Write the dummy data to the file

      const result = collectStatementsAndCommentsFromCSV(csvFilePath);

      fs.unlinkSync(csvFilePath); // Remove the test file

      expect(result).toEqual([
        { statement: "statement 1", comments: "comment 1" },
        { statement: "statement 2", comments: "comment 2" },
      ]);
    });
  });

  describe("generateEvaluationReport", () => {
    it("should generate a report with correct percentages and formatting", () => {
      const results: AutoratingAggregatedResults = {
        totalStatements: 10,
        questions: {
          "Question 1": { pass: 7, fail: 2, unsure: 1 },
          "Question 2": { pass: 5, fail: 5, unsure: 0 },
        },
      };
      const totalRuntimeMinutes = 5.25;

      const report = generateEvaluationReport(results, totalRuntimeMinutes);

      expect(report).toContain("Summary Evaluation Report");
      expect(report).toContain("Total statements: 10");

      expect(report).toContain("Question 1");
      expect(report).toContain("Pass: 70% (7/10)");
      expect(report).toContain("Fail: 20% (2/10)");
      expect(report).toContain("Unsure: 10% (1/10)");

      expect(report).toContain("Question 2");
      expect(report).toContain("Pass: 50% (5/10)");
      expect(report).toContain("Fail: 50% (5/10)");
      expect(report).toContain("Unsure: 0% (0/10)");

      expect(report).toContain("Total runtime: 5.25 minutes");
    });
  });
});
