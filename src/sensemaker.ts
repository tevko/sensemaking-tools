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

// Module to interact with sensemaking tools.

import { generateTopicModelingPrompt, learnedTopicsValid } from "./tasks/topic_modeling";
import { MAX_RETRIES, RETRY_DELAY_MS } from "./models/vertex_model";
import {
  CommentRecord,
  Comment,
  SummarizationType,
  Summary,
  FlatTopic,
  NestedTopic,
  Topic,
} from "./types";
import { categorizeWithRetry, generateCategorizationPrompt } from "./tasks/categorization";
import { basicSummarize, voteTallySummarize } from "./tasks/summarization";
import { getPrompt, hydrateCommentRecord } from "./sensemaker_utils";
import { Type } from "@sinclair/typebox";
import { ModelSettings, Model } from "./models/model";
import { groundSummary } from "./tasks/grounding";

// Class to make sense of a deliberation. Uses LLMs to learn what topics were discussed and
// categorize comments. Then these categorized comments can be used with optional Vote data to
// summarize a deliberation.
export class Sensemaker {
  private modelSettings: ModelSettings;

  /**
   * Creates a Sensemaker object
   * @param modelSettings what models to use for what tasks, a default model can be set.
   */
  constructor(modelSettings: ModelSettings) {
    this.modelSettings = modelSettings;
  }

  /**
   * Get corresponding model from modelSettings object, or defaultModel if none specified.
   * @param modelSetting the key of the modelSettings options you want the Model for (corresponding to task)
   * @return The model to use for the corresponding ModelSetting key
   */
  getModel(modelSetting: keyof ModelSettings): Model {
    // Consider getting rid of this function once we have non default model
    // implementations, in case we want to switch to a static compilation of the correct model for each key.
    return this.modelSettings[modelSetting] || this.modelSettings.defaultModel;
  }

  /**
   * Summarize a set of comments using all available metadata.
   * @param comments the text and (optional) vote data to consider
   * @param summarizationType what summarization method to use
   * @param topics the set of topics that should be present in the final summary
   * @param additionalInstructions additional context to give the model as part of the prompt
   * @returns a summary of the information.
   */
  public async summarize(
    comments: Comment[],
    summarizationType: SummarizationType = SummarizationType.VOTE_TALLY,
    topics?: Topic[],
    additionalInstructions?: string
  ): Promise<Summary> {
    let summary: string;
    const model: Model = this.getModel("summarizationModel");
    if (summarizationType == SummarizationType.BASIC) {
      summary = await basicSummarize(comments, model, additionalInstructions);
    } else if (summarizationType == SummarizationType.VOTE_TALLY) {
      summary = await voteTallySummarize(comments, model, additionalInstructions);
    } else {
      throw TypeError("Unknown Summarization Type.");
    }
    return groundSummary(this.getModel("groundingModel"), summary, comments);
  }

  /**
   * Extracts topics from the comments using a LLM on Vertex AI. Retries if the LLM response is invalid.
   * @param comments The comments data for topic modeling
   * @param includeSubtopics Whether to include subtopics in the topic modeling
   * @param topics Optional. The user provided top-level topics, if these are specified only
   * subtopics will be learned.
   * @param additionalInstructions Optional. Context to add to the LLM prompt.
   * @returns: Topics (optionally containing subtopics) representing what is discussed in the
   * comments.
   */
  public async learnTopics(
    comments: Comment[],
    includeSubtopics: boolean,
    topics?: Topic[],
    additionalInstructions?: string
  ): Promise<Topic[]> {
    const instructions = generateTopicModelingPrompt(includeSubtopics, topics);

    // surround each comment by triple backticks to avoid model's confusion with single, double quotes and new lines
    const commentTexts = comments.map((comment) => "```" + comment.text + "```");
    // decide which schema to use based on includeSubtopics
    const schema = Type.Array(includeSubtopics ? NestedTopic : FlatTopic);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = (await this.getModel("categorizationModel").generateData(
        getPrompt(instructions, commentTexts, additionalInstructions),
        schema
      )) as Topic[];

      if (learnedTopicsValid(response, topics)) {
        return response;
      } else {
        console.warn(
          `Learned topics failed validation, attempt ${attempt}. Retrying in ${RETRY_DELAY_MS / 1000} seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    throw new Error("Topic modeling failed after multiple retries.");
  }

  /**
   * Categorize the comments by topics using a LLM on Vertex.
   * @param comments The data to summarize
   * @param includeSubtopics Whether to include subtopics in the categorization.
   * @param topics The user provided topics (and optionally subtopics).
   * @param additionalInstructions Optional. Context to add to the LLM prompt.
   * @returns: The LLM's categorization.
   */
  public async categorizeComments(
    comments: Comment[],
    includeSubtopics: boolean,
    topics?: Topic[],
    additionalInstructions?: string
  ): Promise<Comment[]> {
    if (!topics) {
      topics = await this.learnTopics(
        comments,
        includeSubtopics,
        undefined,
        additionalInstructions
      );
    }

    const instructions = generateCategorizationPrompt(topics, includeSubtopics);

    // Call the model in batches, validate results and retry if needed.
    const categorized: CommentRecord[] = [];
    for (
      let i = 0;
      i < comments.length;
      i += this.modelSettings.defaultModel.categorizationBatchSize
    ) {
      const uncategorizedBatch = comments.slice(
        i,
        i + this.modelSettings.defaultModel.categorizationBatchSize
      );
      const categorizedBatch = await categorizeWithRetry(
        this.modelSettings.defaultModel,
        instructions,
        uncategorizedBatch,
        includeSubtopics,
        topics,
        additionalInstructions
      );
      categorized.push(...categorizedBatch);
    }

    return hydrateCommentRecord(categorized, comments);
  }
}
