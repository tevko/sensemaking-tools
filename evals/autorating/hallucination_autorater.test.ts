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

import { rateHallucination } from "./hallucination_autorater";
import { VertexModel } from "../../src/models/vertex_model";
import { StatementWithComments } from "./autorating_utils";
import fs from "fs";
import * as path from "path";

jest.mock("../../src/models/vertex_model"); // Mock the VertexModel

describe("rateHallucination", () => {
  let mockModel: jest.Mocked<VertexModel>;
  const mockOutputDir = "test_output";

  beforeEach(() => {
    mockModel = new VertexModel("", "", "") as jest.Mocked<VertexModel>; // Create a mocked instance
    // Ensure output directory exists and is empty
    if (!fs.existsSync(mockOutputDir)) {
      fs.mkdirSync(mockOutputDir);
    } else {
      fs.rmSync(mockOutputDir, { recursive: true, force: true }); // Clean up after previous tests
      fs.mkdirSync(mockOutputDir);
    }
  });

  afterEach(() => {
    fs.rmSync(mockOutputDir, { recursive: true, force: true }); // Clean up after each test
  });

  it("should correctly process summaries and generate report", async () => {
    const summaries: StatementWithComments[] = [
      { statement: "Statement 1", comments: "Comment 1" },
      { statement: "Statement 2", comments: "Comment 2" },
    ];
    const mockResponseData = {
      analysis: "Test analysis",
      answer: "YES",
      explanation: "Test explanation",
    };
    mockModel.generateData.mockResolvedValue(mockResponseData); // Mock generateData to resolve with mock data

    await rateHallucination(mockModel, summaries, mockOutputDir);

    // Check if the files were created
    const csvPath = path.join(mockOutputDir, "hallucination_autoratings.csv");
    const reportPath = path.join(mockOutputDir, "hallucination_report.txt");
    expect(fs.existsSync(csvPath)).toBe(true);
    expect(fs.existsSync(reportPath)).toBe(true);

    // Check some of the CSV content and aggregated results
    const csvContent = fs.readFileSync(csvPath, "utf8");
    expect(csvContent).toContain("Statement 1");
    expect(csvContent).toContain("YES"); // Hallucination result for Statement 1

    // Check report content
    const reportContent = fs.readFileSync(reportPath, "utf8");
    expect(reportContent).toContain("Summary Evaluation Report");
    expect(reportContent).toContain("Total statements: 2");
  });

  it("should handle LLM errors gracefully", async () => {
    const summaries: StatementWithComments[] = [
      { statement: "Statement 1", comments: "Comment 1" },
    ];
    mockModel.generateData.mockRejectedValue(new Error("LLM Error")); // Mock an LLM error
    const consoleErrorSpy = jest.spyOn(console, "error");

    await rateHallucination(mockModel, summaries, mockOutputDir);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error during LLM call or parsing:",
      expect.any(Error)
    );

    // Check for NULL values in CSV due to the error
    const csvPath = path.join(mockOutputDir, "hallucination_autoratings.csv");
    expect(fs.existsSync(csvPath)).toBe(true);
    const csvContent = fs.readFileSync(csvPath, "utf8");
    expect(csvContent).toContain("NULL");

    consoleErrorSpy.mockRestore();
  });

  it("should handle invalid responses from LLM", async () => {
    const summaries: StatementWithComments[] = [
      { statement: "Statement 1", comments: "Comment 1" },
    ];
    mockModel.generateData.mockResolvedValue(null); // Mock invalid response
    const consoleWarnSpy = jest.spyOn(console, "warn");

    await rateHallucination(mockModel, summaries, mockOutputDir);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Skipping statement due to LLM error or invalid response."
    );
    consoleWarnSpy.mockRestore();
  });
});
