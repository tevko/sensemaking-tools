// Rerun summarize 5x using a CSV file as input and outputting the summaries to another CSV.
// Run like:
// npx ts-node ./evaluations/rerunner.ts --outputFile "data1.csv" \
// --vertexProject "<your project name here>" \
// --inputFile "/usr/local/google/home/achvasta/Downloads/comments-with-vote-tallies.csv"
// --rerunCount 3

import { Command } from "commander";
import { Sensemaker } from "../src/sensemaker";
import { VertexModel } from "../src/models/vertex_model";
import { Comment, SummarizationType, Summary, VoteTally } from "../src/types";
import { createObjectCsvWriter } from "csv-writer";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse";

interface outputCsvFormat {
  run: number;
  summaryType: string;
  text: string;
}

// TODO: remove this and make it more general
type VoteTallyCsvRow = {
  index: number;
  timestamp: number;
  datetime: string;
  "comment-id": number;
  "author-id": number;
  agrees: number;
  disagrees: number;
  moderated: number;
  comment_text: string;
  passes: number;
  "group-0-disagree-count": number;
  "group-0-pass-count": number;
  "group-0-agree-count": number;
  "group-1-disagree-count": number;
  "group-1-pass-count": number;
  "group-1-agree-count": number;
};

async function getSummary(project: string, comments: Comment[]): Promise<Summary> {
  const sensemaker = new Sensemaker({
    defaultModel: new VertexModel(project, "us-central1", "gemini-1.5-pro-002"),
  });
  return await sensemaker.summarize(comments, SummarizationType.VOTE_TALLY);
}

async function getCommentsFromCsv(inputFilePath: string): Promise<Comment[]> {
  const filePath = path.resolve(inputFilePath);
  const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });

  const parser = parse(fileContent, {
    delimiter: ",",
    columns: true,
  });

  return new Promise((resolve, reject) => {
    const data: Comment[] = [];
    fs.createReadStream(filePath)
      .pipe(parser)
      .on("error", (error) => reject(error))
      .on("data", (row: VoteTallyCsvRow) => {
        if (row.moderated == -1) {
          return;
        }
        data.push({
          text: row.comment_text,
          id: row["comment-id"].toString(),
          voteTalliesByGroup: {
            "group-0": new VoteTally(
              row["group-0-agree-count"],
              row["group-0-disagree-count"],
              row["group-0-pass-count"]
            ),
            "group-1": new VoteTally(
              row["group-1-agree-count"],
              row["group-1-disagree-count"],
              row["group-1-pass-count"]
            ),
          },
        });
      })
      .on("end", () => resolve(data));
  });
}

async function main(): Promise<void> {
  // Parse command line arguments.
  const program = new Command();
  program
    .option("-o, --outputFile <file>", "The output file name.")
    .option("-i, --inputFile <file>", "The input file name.")
    .option("-r, --rerunCount <count>", "The number of times to rerun.")
    .option("-v, --vertexProject <project>", "The Vertex Project name.");
  program.parse(process.argv);
  const options = program.opts();

  const comments = await getCommentsFromCsv(options.inputFile);

  let outputTexts: outputCsvFormat[] = [];
  const csvWriter = createObjectCsvWriter({
    path: options.outputFile,
    header: ["run", "summaryType", "text"],
  });

  for (let i = 0; i < options.rerunCount; i++) {
    const summary = await getSummary(options.vertexProject, comments);
    outputTexts = outputTexts.concat([
      {
        run: i,
        summaryType: "VoteTally",
        text: summary.getText("MARKDOWN"),
      },
    ]);
  }

  csvWriter.writeRecords(outputTexts).then(() => console.log("CSV file written successfully."));
}

main();
