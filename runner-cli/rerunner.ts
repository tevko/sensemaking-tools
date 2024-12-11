// Rerun summarize 5x using a CSV file as input and outputting the summaries to another CSV.
// Run like:
// npx ts-node ./evaluations/rerunner.ts --outputFile "data1.csv" \
// --vertexProject "<your project name here>" \
// --inputFile "/usr/local/google/home/achvasta/Downloads/comments-with-vote-tallies.csv"
// --rerunCount 3

import { Command } from "commander";
import { createObjectCsvWriter } from "csv-writer";
import { getCommentsFromCsv, getSummary } from "./runner_utils";

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
