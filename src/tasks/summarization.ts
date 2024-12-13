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
import { Comment, SummarizationType } from "../types";
import { getPrompt } from "../sensemaker_utils";
import { SummaryStats, TopicStats } from "../stats_util";

export function getSummarizationInstructions(
  includeGroups: boolean,
  summaryStats: SummaryStats
): string {
  // Prepare statistics like vote count and number of comments per topic for injecting in prompt as
  // well as sorts topics based on count.
  const topicStats = summaryStats.getStatsByTopic();
  const sortedTopics = _sortTopicsByComments(topicStats);
  const quantifiedTopics = _quantifyTopicNames(sortedTopics);

  return `You’re analyzing the results of a public deliberation on a topic. It contains comments and associated votes.
You will summarize with the summary having all of the following categories and subcategories:

${JSON.stringify(quantifiedTopics, null, 2)}

Use categories or subcategories names exactly as they are provided (for example: "Topic Name (10 comments)").

Your task is to write a summary for each section, taking into account the opinions of the groups, including minority viewpoints.

First explain the perspectives of each group, highlighting common ground and points of division.
Then, for areas of disagreement, analyze comments to see if there's a solution backed by the statements, that can be served as a common ground endorsed by all groups. Do not suggest any novel ideas not grounded in the statements.
Finally, rewrite the section summary incorporating the common ground and divisions with potential solutions grounded in the statements.
The new summary should be substantiated, detailed and informative: include specific findings, requests, proposals, action items and examples, grounded in the deliberation statements.

Do not generate:
- Generic summaries (e.g., "There was discussion about ...")
- Broad statements lacking specific details (e.g., "In many areas, ..."")
Do not include group vote tallies in the summary.
Do not crop the response; include all sections of the deliberation.

The summary must follow this format:

## Intro
${includeGroups ? "## Description of Groups" : ""}
## Topic Analysis
### Topic 1 (with number of comments)
  * **Subtopic 1** (with number of comments)
    * _High consensus:_
    * _Low consensus:_
  * **Subtopic 2** (with number of comments)
    * _High consensus:_
    * _Low consensus:_
### Topic 2 (with number of comments)
  * **Subtopic 3** (with number of comments)
    * _High consensus:_
    * _Low consensus:_
## Conclusion

The introduction should be one paragraph long and contain ${includeGroups ? "five" : "four"} sentences.
The first sentence should include the information that there were ${summaryStats.commentCount} statements ${includeGroups ? `that had ${summaryStats.voteCount} votes` : ""}.
The second sentence should include what topics were discussed. 
${
  includeGroups
    ? "The third sentence should include information on the groups such " +
      "as their similarities and differences. "
    : ""
} 
The next sentence should list topics with consensus.
The last sentence should list topics without consensus.

${includeGroups ? "There should be a one-paragraph section describing the voting groups, focusing on their expressed views without guessing demographics." : ""}
`;
}

/**
 * Summarizes comments based on the specified summarization type.
 *
 * @param model The language model to use for summarization.
 * @param comments An array of `Comment` objects containing the comments to summarize.
 * @param summarizationType The type of summarization to perform (e.g., BASIC, VOTE_TALLY).
 * @param additionalInstructions Optional additional instructions to guide the summarization process. These instructions will be included verbatim in the prompt sent to the LLM.
 * @returns A Promise that resolves to the generated summary string.
 * @throws {TypeError} If an unknown `summarizationType` is provided.
 */
export async function summarizeByType(
  model: Model,
  summaryStats: SummaryStats,
  summarizationType: SummarizationType,
  additionalInstructions?: string
): Promise<string> {
  if (summarizationType === SummarizationType.BASIC) {
    return await basicSummarize(summaryStats, model, additionalInstructions);
  } else if (summarizationType === SummarizationType.VOTE_TALLY) {
    return await voteTallySummarize(summaryStats, model, additionalInstructions);
  } else {
    throw new TypeError("Unknown Summarization Type.");
  }
}

/**
 * Summarizes the comments using a LLM on Vertex.
 * @param instructions: how the comments should be summarized.
 * @param comments: the data to summarize
 * @param additionalInstructions: additional context to include in the prompt.
 * @returns: the LLM's summarization.
 */
export async function basicSummarize(
  summaryStats: SummaryStats,
  model: Model,
  additionalInstructions?: string
): Promise<string> {
  const commentTexts = summaryStats.comments.map((comment) => comment.text);
  return await model.generateText(
    getPrompt(
      getSummarizationInstructions(false, summaryStats),
      commentTexts,
      additionalInstructions
    )
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
  summaryStats: SummaryStats,
  model: Model,
  additionalInstructions?: string
): Promise<string> {
  return await model.generateText(
    getPrompt(
      getSummarizationInstructions(true, summaryStats),
      formatCommentsWithVotes(summaryStats.comments),
      additionalInstructions
    )
  );
}

/**
 * Sorts topics and their subtopics based on comment count in descending order, with "Other" topics and subtopics going last.
 *
 * @param topics An array of `TopicStats` objects to be sorted.
 * @returns A new array of `TopicStats` objects, sorted by comment count.
 */
export function _sortTopicsByComments(topics: TopicStats[]): TopicStats[] {
  topics.sort((a, b) => {
    if (a.name === "Other") return 1;
    if (b.name === "Other") return -1;
    return b.commentCount - a.commentCount;
  });

  topics.forEach((topic) => {
    if (topic.subtopicStats) {
      topic.subtopicStats.sort((a, b) => {
        if (a.name === "Other") return 1;
        if (b.name === "Other") return -1;
        return b.commentCount - a.commentCount;
      });
    }
  });

  return topics;
}

/**
 * Quantifies topic names by adding the number of associated comments in parentheses.
 *
 * @param topics An array of `TopicStats` objects.
 * @returns A map where keys are quantified topic names and values are arrays of quantified subtopic names.
 *
 * @example
 * Example input:
 * [
 *   {
 *     name: 'Topic A',
 *     commentCount: 5,
 *     subtopicStats: [
 *       { name: 'Subtopic 1', commentCount: 2 },
 *       { name: 'Subtopic 2', commentCount: 3 }
 *     ]
 *   }
 * ]
 *
 * Expected output:
 * {
 *   'Topic A (5 comments)': [
 *     'Subtopic 1 (2 comments)',
 *     'Subtopic 2 (3 comments)'
 *   ]
 * }
 */
export function _quantifyTopicNames(topics: TopicStats[]): { [key: string]: string[] } {
  const result: { [key: string]: string[] } = {};

  for (const topic of topics) {
    const topicName = `${topic.name} (${topic.commentCount} comments)`;

    if (topic.subtopicStats) {
      result[topicName] = topic.subtopicStats.map(
        (subtopic) => `${subtopic.name} (${subtopic.commentCount} comments)`
      );
    }
  }

  return result;
}
