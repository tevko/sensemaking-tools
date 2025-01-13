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

// Run a series of simple evals on summarization. There are sets of evals for quick checks and
// monitoring checks, each of these output a separate CSV. The summaries that are outputted are
// also saved as a CSV.
//
// Eval Types:
// - Quick Checks: binary checks that summarization must pass to not be low quality
// - Monitoring: checks on failure rate and timing
//
// This script can be slow to run and summarization of 1000 comments can take up to 20 minutes
// per run.
//
// Run all checks:
// npx ts-node ./evals/run_checks.ts \
//     --outputDir "./evals" \
//     --vertexProject "<your Vertex Project here>" \
//     --inputFile "~/2018-BG-with-vote-tallies-filtered.csv" \
//     --runCount=10
//
// Run quick checks only:
// npx ts-node ./evals/run_checks.ts \
//     --outputDir "./evals" \
//     --vertexProject "<your Vertex Project here>" \
//     --inputFile "~/2018-BG-with-vote-tallies-filtered.csv" \
//     --runCount=10
//     --runMonitoringChecks=false

import { Command } from "commander";
import { createObjectCsvWriter } from "csv-writer";
import { getCommentsFromCsv, getSummary, getTopicsAndSubtopics } from "../runner-cli/runner_utils";
import { Summary } from "../src/types";
import { runQuickChecks } from "./quick_checks_lib";
import { runMonitoringChecks } from "./monitoring_checks_lib";

const SUMMARIES_OUTPUT_FILE_NAME = "summaries.csv";

async function main(): Promise<void> {
  // Parse command line arguments.
  const program = new Command();
  program
    .requiredOption("-o, --outputDir <file>", "The output directory.")
    .requiredOption("-i, --inputFile <file>", "The input file name.")
    .requiredOption("-r, --runCount <count>", "The number of times to run.")
    .requiredOption("-v, --vertexProject <project>", "The Vertex Project name.")
    // Optional Flags to Run only a subset of evals
    .option("-q, --runQuickChecks <bool>", "Whether to run Quick Checks", true)
    .option("-m --runMonitoringChecks <bool>", "Whether to run Monitoring Checks", true);
  program.parse(process.argv);
  const options = program.opts();
  const project = options.vertexProject;

  // This check is needed for unit tests otherwise there's issues with the inputFile being unset.
  if (!options || !options.inputFile) {
    console.error("Error! The inputFile flag must be set.");
    return;
  }
  const comments = await getCommentsFromCsv(options.inputFile);

  // Use the same discovered topics and subtopics for all summaries to increase consistency and
  // speed up execution.
  const topics = await getTopicsAndSubtopics(project, comments);

  const summaries: Summary[] = [];
  let failureCount = 0;
  const runTimes = [];
  for (let i = 0; i < options.runCount; i++) {
    const startTime = performance.now();
    try {
      summaries.push(await getSummary(project, comments, topics));
      runTimes.push(performance.now() - startTime);
    } catch (error) {
      console.error("Error summarizing: ", error);
      failureCount++;
    }
  }

  if (options.runQuickChecks) {
    runQuickChecks(options.outputDir, summaries, topics);
  }

  if (options.runMonitoringChecks) {
    runMonitoringChecks(options.outputDir, options.runCount, failureCount, runTimes);
  }

  // For easier debugging of evals also output the summaries that were generated.
  const csvWriter = createObjectCsvWriter({
    path: options.outputDir + "/" + SUMMARIES_OUTPUT_FILE_NAME,
    header: ["run", "summary"],
  });
  const outputSummaries = summaries.map((summary: Summary, index: number) => {
    return { run: index, summary: summary.getText("MARKDOWN") };
  });
  csvWriter
    .writeRecords(outputSummaries)
    .then(() => console.log(`${SUMMARIES_OUTPUT_FILE_NAME} file written successfully.`));
}

main();
