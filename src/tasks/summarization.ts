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

// Functions for different ways to summarize Comment and Vote data.

import { Model } from "../models/model";
import { Comment } from "../types";
import { getPrompt } from "../sensemaker_utils";

function getSummarizationInstructions(includeGroups: boolean): string {
  return `Please summarize the public's perspective in relation to the comments
 submitted, making sure to include a section that's broken down by topic on both areas of
 disagreement between the groups, as well as points of common ground. 
 
 ${
   includeGroups
     ? "There should also be a section describing the two voting groups. Focus on the " +
       "group's expressed views and don't guess the demographics of the groups. This section " +
       "should be one paragraph long."
     : ""
 }
 
 The summary should follow this format:
 - Intro
 ${includeGroups ? "- Description of Groups" : ""}
 - Areas of Disagreement
 - Areas of Agreement
 - Conclusion

 Section names should be bolded.`;
}

/**
 * Summarizes the comments using a LLM on Vertex.
 * @param instructions: how the comments should be summarized.
 * @param comments: the data to summarize
 * @param additionalInstructions: additional context to include in the prompt.
 * @returns: the LLM's summarization.
 */
export async function basicSummarize(
  comments: Comment[],
  model: Model,
  additionalInstructions?: string
): Promise<string> {
  const commentTexts = comments.map((comment) => comment.text);
  return await model.generateText(
    getPrompt(getSummarizationInstructions(false), commentTexts, additionalInstructions)
  );
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
 * Summarizes the comments using a LLM on Vertex.
 * @param instructions: how the comments should be summarized.
 * @param commentData: the data to summarize, as an array of Comment objects
 * @param additionalInstructions: additional context to include in the prompt.
 * @returns: the LLM's summarization.
 */
export async function voteTallySummarize(
  comments: Comment[],
  model: Model,
  additionalInstructions?: string
): Promise<string> {
  return await model.generateText(
    getPrompt(
      getSummarizationInstructions(true),
      formatCommentsWithVotes(comments),
      additionalInstructions
    )
  );
}
