// Run the summarizer based on a CSV input and output the result as an hmtl page.

import { Command } from "commander";
import * as fs from "fs";
import { marked } from "marked";
import { getCommentsFromCsv, getSummary } from "./runner_utils";

async function main(): Promise<void> {
  // Parse command line arguments.
  const program = new Command();
  program
    .option("-o, --outputFile <file>", "The output file name.")
    .option("-i, --inputFile <file>", "The input file name.")
    .option("-v, --vertexProject <project>", "The Vertex Project name.");
  program.parse(process.argv);
  const options = program.opts();

  const comments = await getCommentsFromCsv(options.inputFile);

  const summary = await getSummary(options.vertexProject, comments);
  const markdownContent = summary.getText("MARKDOWN");
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Summary</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
    </style>
</head>
<body>
    ${marked(markdownContent)}
</body>
</html>`;

  const outputPath = `${options.outputFile}.html`;
  fs.writeFileSync(outputPath, htmlContent);
  console.log(`Written summary to ${outputPath}`);
}

main();
