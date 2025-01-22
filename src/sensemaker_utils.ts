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
import { RETRY_DELAY_MS } from "./models/vertex_model";
import { commentCitation } from "./validation/grounding";

/**
 * Rerun a function multiple times.
 * @param func the function to attempt
 * @param isValid checks that the response from func is valid
 * @param maxRetries the maximum number of times to retry func
 * @param errorMsg the error message to throw
 * @param retryDelayMS how long to wait in miliseconds between calls
 * @param funcArgs the args for func and isValid
 * @param isValidArgs the args for isValid
 * @returns the valid response from func
 */
/* eslint-disable  @typescript-eslint/no-explicit-any */
export async function retryCall<T>(
  func: (...args: any[]) => Promise<T>,
  isValid: (response: T, ...args: any[]) => boolean,
  maxRetries: number,
  errorMsg: string,
  retryDelayMS: number = RETRY_DELAY_MS,
  funcArgs: any[],
  isValidArgs: any[]
) {
  /* eslint-enable  @typescript-eslint/no-explicit-any */
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await func(...funcArgs);
      if (isValid(response, ...isValidArgs)) {
        return response;
      }
      console.error(`Attempt ${attempt} failed. Invalid response:`, response);
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
    }

    console.log(`Retrying in ${retryDelayMS / 1000} seconds`);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMS));
  }
  throw new Error(`Failed after ${maxRetries} attempts: ${errorMsg}`);
}

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
 * Utility function for formatting the comments together with vote tally data
 * @param commentData: the data to summarize, as an array of Comment objects
 * @returns: comments, together with vote tally information as JSON
 */
export function formatCommentsWithVotes(commentData: Comment[]): string[] {
  return commentData.map(
    (comment: Comment) =>
      comment.text + "\n      vote info per group: " + JSON.stringify(comment.voteTalliesByGroup)
  );
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
export function groupCommentsBySubtopic(categorized: Comment[]): {
  [topicName: string]: {
    [subtopicName: string]: { [commentId: string]: Comment };
  };
} {
  const groupedComments: {
    [topicName: string]: {
      [subtopicName: string]: { [commentId: string]: Comment };
    };
  } = {};
  for (const comment of categorized) {
    if (!comment.topics || comment.topics.length === 0) {
      console.log(`Comment with ID ${comment.id} has no topics assigned.`);
      continue;
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
          groupedComments[topic.name][subtopic.name][comment.id] = comment;
        }
      }
    }
  }
  return groupedComments;
}

/**
 * Create citations for comments in the format of "[12, 43, 56]"
 * @param comments the comments to use for citations
 * @returns the formatted citations as a string
 */
export function getCommentCitations(comments: Comment[]): string {
  return "[" + comments.map((comment) => commentCitation(comment)).join(", ") + "]";
}
