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

import { Sensemaker } from "../src/sensemaker";
import { VertexModel } from "../src/models/vertex_model";
import { Summary, VoteTally, Comment, SummarizationType, Topic } from "../src/types";
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

export async function getTopicsAndSubtopics(
  project: string,
  comments: Comment[]
): Promise<Topic[]> {
  const sensemaker = new Sensemaker({
    defaultModel: new VertexModel(project, "us-central1"),
  });
  return await sensemaker.learnTopics(comments, true);
}

export async function getSummary(
  project: string,
  comments: Comment[],
  topics?: Topic[]
): Promise<Summary> {
  const sensemaker = new Sensemaker({
    defaultModel: new VertexModel(project, "us-central1"),
  });
  return await sensemaker.summarize(comments, SummarizationType.VOTE_TALLY, topics);
}

export async function getCommentsFromCsv(inputFilePath: string): Promise<Comment[]> {
  if (!inputFilePath) {
    throw new Error("Input file path is missing!");
  }
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
              Number(row["group-0-agree-count"]),
              Number(row["group-0-disagree-count"]),
              Number(row["group-0-pass-count"])
            ),
            "group-1": new VoteTally(
              Number(row["group-1-agree-count"]),
              Number(row["group-1-disagree-count"]),
              Number(row["group-1-pass-count"])
            ),
          },
        });
      })
      .on("end", () => resolve(data));
  });
}
