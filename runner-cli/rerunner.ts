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

// Rerun summarize 5x using a CSV file as input and outputting the summaries to another CSV.
// Run like:
// npx ts-node ./evaluations/rerunner.ts --outputFile "data1.csv" \
// --vertexProject "<your project name here>" \
// --inputFile "/usr/local/google/home/achvasta/Downloads/comments-with-vote-tallies.csv"
// --rerunCount 3

import { Command } from "commander";
import { createObjectCsvWriter } from "csv-writer";
import {
  getCommentsFromCsv,
  getSummary,
  getTopicsFromComments,
  getTopicsAndSubtopics,
} from "./runner_utils";
import { type Topic } from "../src/types";

interface outputCsvFormat {
  run: number;
  summaryType: string;
  text: string;
}

async function main(): Promise<void> {
  // Parse command line arguments.
  const program = new Command();
  program
    .option("-o, --outputFile <file>", "The output file name.")
    .option("-i, --inputFile <file>", "The input file name.")
    .option(
      "-a, --additionalContext <context>",
      "A short description of the conversation to add context."
    )
    .option("-r, --rerunCount <count>", "The number of times to rerun.")
    .option("-v, --vertexProject <project>", "The Vertex Project name.");
  program.parse(process.argv);
  const options = program.opts();

  const comments = await getCommentsFromCsv(options.inputFile);
  // check if any comments have topics before using getTopicsFromComments, otherwise, learn topics using runner_utils function
  let topics: Topic[];
  if (comments.length > 0 && comments.some((comment) => comment.topics)) {
    console.log("Comments already have topics. Skipping topic learning.");
    topics = getTopicsFromComments(comments);
  } else {
    console.log("Learning topics from comments.");
    topics = await getTopicsAndSubtopics(options.vertexProject, comments);
  }

  let outputTexts: outputCsvFormat[] = [];
  const csvWriter = createObjectCsvWriter({
    path: options.outputFile,
    header: ["run", "summaryType", "text"],
  });

  for (let i = 0; i < options.rerunCount; i++) {
    const summary = await getSummary(
      options.vertexProject,
      comments,
      topics,
      options.additionalContext
    );
    outputTexts = outputTexts.concat([
      {
        run: i,
        summaryType: "Multi Step",
        text: summary.getText("MARKDOWN"),
      },
    ]);
  }

  csvWriter.writeRecords(outputTexts).then(() => console.log("CSV file written successfully."));
}

main();
