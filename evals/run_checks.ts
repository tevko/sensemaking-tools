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
// - Qualitative: checks the number of times different groups are referenced. The value is expected
//      to be between the Fixed Representation and Proportional Representation value.
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
//     --groupNames "group-1,group-0"
//     --groupSizes 10,7
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
import { runQuickChecks } from "./quick_checks_lib";
import { runMonitoringChecks } from "./monitoring_checks_lib";
import { runQualitativeChecks } from "./qualitative_checks_lib";

const SUMMARIES_OUTPUT_FILE_NAME = "summaries.csv";

function listsToMap<K, V>(keys: K[], values: V[]): Map<K, V> {
  if (keys.length !== values.length) {
    throw new Error("Keys and values arrays must have the same length");
  }

  const map = new Map<K, V>();
  for (let i = 0; i < keys.length; i++) {
    map.set(keys[i], values[i]);
  }
  return map;
}

function listParser(value: string): string[] {
  return value.split(",").map((item) => item.trim());
}

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
    .option("-u, --runQualitativeChecks <bool>", "Whether to run Qualitative Checks", true)
    .option("-m --runMonitoringChecks <bool>", "Whether to run Monitoring Checks", true)
    // Required flags for running with runQualitativeChecks
    .option("-n, --groupNames <items>", "comma separated list of group names", listParser, [
      "group-0",
      "group-1",
    ])
    .option(
      "-s, --groupSizes <items>",
      "comma separated list of group sizes. This should be in the same order as groupNames",
      listParser,
      []
    );
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

  const summaries: string[] = [];
  let failureCount = 0;
  const runTimes = [];
  for (let i = 0; i < options.runCount; i++) {
    const startTime = performance.now();
    try {
      summaries.push((await getSummary(project, comments, topics)).getText("MARKDOWN"));
      runTimes.push(performance.now() - startTime);
    } catch (error) {
      console.error("Error summarizing: ", error);
      failureCount++;
    }
  }

  // For easier debugging of evals also output the summaries that were generated.
  const csvWriter = createObjectCsvWriter({
    path: options.outputDir + "/" + SUMMARIES_OUTPUT_FILE_NAME,
    header: [
      { id: "run", title: "Run" },
      { id: "summary", title: "Summary" },
    ],
  });
  const outputSummaries = summaries.map((summary: string, index: number) => {
    return { run: index, summary: summary };
  });
  csvWriter
    .writeRecords(outputSummaries)
    .then(() => console.log(`${SUMMARIES_OUTPUT_FILE_NAME} file written successfully.`));

  if (options.runQuickChecks) {
    runQuickChecks(options.outputDir, summaries, topics);
  }

  if (options.runMonitoringChecks) {
    runMonitoringChecks(options.outputDir, options.runCount, failureCount, runTimes);
  }

  if (summaries.length == 0) {
    return;
  }

  if (options.runQualitativeChecks) {
    if (!options.groupNames || !options.groupSizes) {
      throw new Error(
        "The groupNames and groupSizes args are required when running QualitativeChecks"
      );
    }

    runQualitativeChecks(
      options.outputDir,
      summaries,
      listsToMap(options.groupNames, options.groupSizes.map(Number))
    );
  }
}

main();
