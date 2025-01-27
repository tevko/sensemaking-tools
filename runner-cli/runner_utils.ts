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

// This code processes data from the `bin/` directory ingest scripts. In general, the shape
// takes the form of the `CoreCommentCsvRow` structure below, together with the vote tally
// columns as specified by `VoteTallyGroupKey`

import { Sensemaker } from "../src/sensemaker";
import { VertexModel } from "../src/models/vertex_model";
import { Summary, VoteTally, Comment, SummarizationType, Topic } from "../src/types";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse";

/**
 * Core comment columns, sans any vote tally rows
 */
type CoreCommentCsvRow = {
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
  topic: string;
  subtopic: string;
};

// Make this interface require that key names look like `group-N-VOTE-count`
type VoteTallyGroupKey =
  | `group-${number}-agree-count`
  | `group-${number}-disagree-count`
  | `group-${number}-pass-count`;

export interface VoteTallyCsvRow {
  [key: VoteTallyGroupKey]: number;
}

//This is a type that combines VoteTallyCsvRow and CoreCommentCsvRow
export type CommentCsvRow = VoteTallyCsvRow & CoreCommentCsvRow;

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
  topics?: Topic[],
  additionalInstructions?: string
): Promise<Summary> {
  const sensemaker = new Sensemaker({
    defaultModel: new VertexModel(project, "us-central1"),
  });
  return await sensemaker.summarize(
    comments,
    SummarizationType.MULTI_STEP,
    topics,
    additionalInstructions
  );
}

/**
 * Gets comments from a CSV file, in the style of the output from the input processing files
 * in the project's `bin/` directory. Core CSV rows are as for `CoreCommentCsvRow`, plus any
 * vote tallies in `VoteTallyCsvRow`.
 * @param inputFilePath
 * @returns
 */
export async function getCommentsFromCsv(inputFilePath: string): Promise<Comment[]> {
  // Determine the number of groups from the header row
  const header = fs.readFileSync(inputFilePath, { encoding: "utf-8" }).split("\n")[0];
  const numGroups = new Set(header.match(/group-\d/g) || []).size;

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
      .on("error", reject)
      .on("data", (row: CommentCsvRow) => {
        if (row.moderated == -1) {
          return;
        }
        const newComment: Comment = {
          text: row.comment_text,
          id: row["comment-id"].toString(),
          voteTalliesByGroup: {},
        };
        const voteTalliesByGroup: { [key: string]: VoteTally } = {};
        for (let i = 0; i < numGroups; i++) {
          const groupKey: string = `group-${i}`;
          voteTalliesByGroup[groupKey] = new VoteTally(
            Number(row[`${groupKey}-agree-count` as VoteTallyGroupKey]),
            Number(row[`${groupKey}-disagree-count` as VoteTallyGroupKey]),
            Number(row[`${groupKey}-pass-count` as VoteTallyGroupKey])
          );
        }
        newComment.voteTalliesByGroup = voteTalliesByGroup;

        // Add topics and subtopics if available
        if (row.topic && row.subtopic) {
          newComment.topics = [];
          newComment.topics.push({
            name: row.topic.toString(),
            subtopics: [{ name: row.subtopic.toString() }],
          });
        }

        data.push(newComment);
      })
      .on("end", () => resolve(data));
  });
}

export function getTopicsFromComments(comments: Comment[]): Topic[] {
  // Create a map from the topic name to a set of subtopic names.
  const mapTopicToSubtopicSet: { [topicName: string]: Set<string> } = {};
  for (const comment of comments) {
    for (const topic of comment.topics || []) {
      if (mapTopicToSubtopicSet[topic.name] == undefined) {
        mapTopicToSubtopicSet[topic.name] = new Set();
      }
      if ("subtopics" in topic) {
        for (const subtopic of topic.subtopics || []) {
          mapTopicToSubtopicSet[topic.name].add(subtopic.name);
        }
      }
    }
  }

  // Convert that map to a Topic array and return
  const returnTopics: Topic[] = [];
  for (const topicName in mapTopicToSubtopicSet) {
    const topic: Topic = { name: topicName, subtopics: [] };
    for (const subtopicName of mapTopicToSubtopicSet[topicName]!.keys()) {
      topic.subtopics.push({ name: subtopicName });
    }
    returnTopics.push(topic);
  }
  return returnTopics;
}
