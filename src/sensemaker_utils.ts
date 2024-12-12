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

// Simple utils.

import { CommentRecord, Comment } from "./types";
/**
 * Combines the data and instructions into a prompt to send to Vertex.
 * @param instructions: what the model should do.
 * @param data: the data that the model should consider.
 * @param additionalInstructions additional context to include in the prompt.
 * @returns the instructions and the data as a text
 */
export function getPrompt(instructions: string, data: string[], additionalInstructions?: string) {
  return `Instructions:
${instructions}
${additionalInstructions ? "\nAdditional context:\n" + additionalInstructions + "\n" : ""}
Comments:
${data.join("\n")}`; // separate comments with newlines
}

/**
 * Converts the given commentRecords to Comments.
 * @param commentRecords what to convert to Comments
 * @param missingTexts the original comments with IDs match the commentRecords
 * @returns a list of Comments with all possible fields from commentRecords.
 */
export function hydrateCommentRecord(
  commentRecords: CommentRecord[],
  missingTexts: Comment[]
): Comment[] {
  const inputCommentsLookup = new Map<string, Comment>(
    missingTexts.map((comment: Comment) => [comment.id, comment])
  );
  return commentRecords
    .map((commentRecord: CommentRecord): Comment | undefined => {
      // Combine the matching Comment with the topics from the CommentRecord.
      const comment = inputCommentsLookup.get(commentRecord.id);
      if (comment) {
        comment.topics = commentRecord.topics;
      }
      return comment;
    })
    .filter((comment: Comment | undefined): comment is Comment => {
      return comment !== undefined;
    });
}

/**
 * Groups categorized comments by topic and subtopic.
 *
 * @param categorized An array of categorized comments.
 * @returns A JSON representing the comments grouped by topic and subtopic.
 *
 * Example:
 * {
 *   "Topic 1": {
 *     "Subtopic 2": {
 *       "id 1": "comment 1",
 *       "id 2": "comment 2"
 *     }
 *   }
 * }
 *
 * TODO: create a similar function to group comments by topics only.
 */
export function groupCommentsBySubtopic(categorized: Comment[]) {
  const groupedComments: {
    [topicName: string]: {
      [subtopicName: string]: { [commentId: string]: string };
    };
  } = {};
  for (const comment of categorized) {
    if (!comment.topics || comment.topics.length === 0) {
      throw new Error(`Comment with ID ${comment.id} has no topics assigned.`);
    }
    for (const topic of comment.topics) {
      if (!groupedComments[topic.name]) {
        groupedComments[topic.name] = {}; // init new topic name
      }
      if ("subtopics" in topic) {
        for (const subtopic of topic.subtopics || []) {
          if (!groupedComments[topic.name][subtopic.name]) {
            groupedComments[topic.name][subtopic.name] = {}; // init new subtopic name
          }
          groupedComments[topic.name][subtopic.name][comment.id] = comment.text;
        }
      }
    }
  }
  return groupedComments;
}
