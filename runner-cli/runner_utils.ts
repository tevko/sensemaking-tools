import { Sensemaker } from "../src/sensemaker";
import { VertexModel } from "../src/models/vertex_model";
import { Summary, VoteTally, Comment, SummarizationType } from "../src/types";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse";

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

export async function getSummary(project: string, comments: Comment[]): Promise<Summary> {
  const sensemaker = new Sensemaker({
    defaultModel: new VertexModel(project, "us-central1", "gemini-1.5-pro-002"),
  });
  return await sensemaker.summarize(comments, SummarizationType.VOTE_TALLY);
}

export async function getCommentsFromCsv(inputFilePath: string): Promise<Comment[]> {
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
