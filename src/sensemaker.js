"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensemakerPrompt = exports.Sensemaker = void 0;
// Module to interact with sensemaking tools.
const topic_modeling_1 = require("./tasks/topic_modeling");
const vertex_model_1 = require("./models/vertex_model");
const types_1 = require("./types");
const categorization_1 = require("./tasks/categorization");
const summarization_1 = require("./tasks/summarization");
const sensemaker_utils_1 = require("./sensemaker_utils");
const typebox_1 = require("@sinclair/typebox");
const grounding_1 = require("./validation/grounding");
const stats_util_1 = require("./stats_util");
const stats_checker_1 = require("./validation/stats_checker");
const recursive_summarization_1 = require("./tasks/summarization_subtasks/recursive_summarization");
// Class to make sense of conversation data. Uses LLMs to learn what topics were discussed and
// categorize comments. Then these categorized comments can be used with optional Vote data to
// summarize a conversation.
class Sensemaker {
    /**
     * Creates a Sensemaker object
     * @param modelSettings what models to use for what tasks, a default model can be set.
     */
    constructor(modelSettings) {
        this.modelSettings = modelSettings;
    }
    /**
     * Get corresponding model from modelSettings object, or defaultModel if none specified.
     * @param modelSetting the key of the modelSettings options you want the Model for (corresponding to task)
     * @return The model to use for the corresponding ModelSetting key
     */
    getModel(modelSetting) {
        // Consider getting rid of this function once we have non default model
        // implementations, in case we want to switch to a static compilation of the correct model for each key.
        return this.modelSettings[modelSetting] || this.modelSettings.defaultModel;
    }
    /**
     * Generates a conversation summary, optionally incorporating vote data.
     *
     * It offers flexibility in how topics for the summary are determined:
     * 1. Categorized Comments: If the input `comments` are already categorized (i.e., they have a
     *    `topics` property), those topics are used directly for the summary structure.
     * 2. Provided Topics:  If `topics` are explicitly provided, they are used to categorize the
     *    comments before summarization. This ensures the summary has statistics based on the
     *    specified topics (like comments count per topic).
     * 3. Learned Topics: If neither categorized comments nor explicit topics are provided, the
     *    function will automatically learn topics from the comments using an LLM. This is the most
     *    automated option but requires more processing time.
     *
     * The function supports different summarization types (e.g., basic summarization,
     * vote-tally-based summarization), and allows for additional instructions to guide the
     * summarization process. The generated summary is then grounded in the original comments to
     * ensure accuracy and relevance.
     *
     * @param comments An array of `Comment` objects representing the public conversation comments. If
     *  these comments are already categorized (have a `topics` property), the summarization will be
     *  based on those existing categories.
     * @param summarizationType  The type of summarization to perform (e.g.,
     *  `SummarizationType.BASIC`, `SummarizationType.VOTE_TALLY`). Defaults to
     *  `SummarizationType.VOTE_TALLY`.
     * @param topics  An optional array of `Topic` objects. If provided, these topics will be used for
     *  comment categorization before summarization, ensuring that the summary addresses the specified
     *  topics. If `comments` are already categorized, this parameter is ignored.
     * @param additionalContext Optional additional context to provide to the LLM for
     *  summarization. The context will be appended verbatim to the summarization prompt. This
     * should be 1-2 sentences on what the conversation is about and where it takes place.
     * @returns A Promise that resolves to a `Summary` object, containing the generated summary text
     *  and metadata.
     */
    summarize(comments_1) {
        return __awaiter(this, arguments, void 0, function* (comments, summarizationType = types_1.SummarizationType.VOTE_TALLY, topics, additionalContext) {
            const startTime = performance.now();
            // categories are required for summarization - make sure comments are categorized
            if (comments.length > 0 && !comments[0].topics) {
                if (!topics) {
                    topics = yield this.learnTopics(comments, true, // including subtopics (as they are important for summaries)
                    undefined, // no top level topics specified
                    additionalContext);
                }
                comments = yield this.categorizeComments(comments, true, topics, additionalContext);
            }
            const summaryStats = summarizationType == types_1.SummarizationType.MULTI_STEP
                ? new stats_util_1.GroupedSummaryStats(comments)
                : new stats_util_1.SummaryStats(comments);
            const summary = yield (0, sensemaker_utils_1.retryCall)(function (model, summaryStats, summarizationType) {
                return __awaiter(this, void 0, void 0, function* () {
                    return (0, summarization_1.summarizeByType)(model, summaryStats, summarizationType, additionalContext);
                });
            }, function (summary, summaryStats, summarizationType) {
                return (0, stats_checker_1.summaryContainsStats)(summary, summaryStats, summarizationType);
            }, vertex_model_1.MAX_RETRIES, "The statistics don't match what's in the summary.", undefined, [this.getModel("summarizationModel"), summaryStats, summarizationType], [summaryStats, summarizationType]);
            // We only apply the grounding routines when not doing multi step summarization
            const groundedSummary = summarizationType == types_1.SummarizationType.MULTI_STEP
                ? (0, grounding_1.parseStringIntoSummary)(summary, comments)
                : yield (0, grounding_1.groundSummary)(this.getModel("groundingModel"), summary, comments);
            console.log(`Summarization took ${(performance.now() - startTime) / (1000 * 60)} minutes.`);
            return groundedSummary;
        });
    }
    /**
     * Extracts topics from the comments using a LLM on Vertex AI. Retries if the LLM response is invalid.
     * @param comments The comments data for topic modeling
     * @param includeSubtopics Whether to include subtopics in the topic modeling
     * @param topics Optional. The user provided top-level topics, if these are specified only
     * subtopics will be learned.
     * @param additionalContext Optional additional context to provide to the LLM for
     *  topic learning. The context will be appended verbatim to the prompt. This
     * should be 1-2 sentences on what the conversation is about and where it takes place.
     * @returns: Topics (optionally containing subtopics) representing what is discussed in the
     * comments.
     */
    learnTopics(comments, includeSubtopics, topics, additionalContext) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            const instructions = (0, topic_modeling_1.generateTopicModelingPrompt)(includeSubtopics, topics);
            // surround each comment by triple backticks to avoid model's confusion with single, double quotes and new lines
            const commentTexts = comments.map((comment) => "```" + comment.text + ` [${comment.id}]` + "```");
            // decide which schema to use based on includeSubtopics
            const schema = typebox_1.Type.Array(includeSubtopics ? types_1.NestedTopic : types_1.FlatTopic);
            return (0, sensemaker_utils_1.retryCall)(function (model) {
                return __awaiter(this, void 0, void 0, function* () {
                    return (yield model.generateData((0, sensemaker_utils_1.getPrompt)(instructions, commentTexts, additionalContext), schema));
                });
            }, function (response) {
                console.log(`Topic learning took ${(performance.now() - startTime) / (1000 * 60)} minutes.`);
                return (0, topic_modeling_1.learnedTopicsValid)(response, topics);
            }, vertex_model_1.MAX_RETRIES, "Topic modeling failed.", undefined, [this.getModel("categorizationModel")], []);
        });
    }
    /**
     * Categorize the comments by topics using a LLM on Vertex.
     * @param comments The data to summarize
     * @param includeSubtopics Whether to include subtopics in the categorization.
     * @param topics The user provided topics (and optionally subtopics).
     * @param additionalContext Optional additional context to provide to the LLM for
     * categorization. The context will be appended verbatim to the prompt. This
     * should be 1-2 sentences on what the conversation is about and where it takes place.
     * @returns: The LLM's categorization.
     */
    categorizeComments(comments, includeSubtopics, topics, additionalContext) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            if (!topics) {
                topics = yield this.learnTopics(comments, includeSubtopics, undefined, additionalContext);
            }
            const instructions = (0, categorization_1.generateCategorizationPrompt)(topics, includeSubtopics);
            // TODO: Consider the effects of smaller batch sizes. 1 comment per batch was much faster, but
            // the distribution was significantly different from what we're currently seeing. More testing
            // is needed to determine the ideal size and distribution.
            const batchesToCategorize = [];
            for (let i = 0; i < comments.length; i += this.modelSettings.defaultModel.categorizationBatchSize) {
                const uncategorizedBatch = comments.slice(i, i + this.modelSettings.defaultModel.categorizationBatchSize);
                batchesToCategorize.push((0, categorization_1.categorizeWithRetry)(this.modelSettings.defaultModel, instructions, uncategorizedBatch, includeSubtopics, topics, additionalContext));
            }
            const categorized = [];
            yield (0, recursive_summarization_1.resolvePromisesInParallel)(batchesToCategorize).then((results) => {
                results.forEach((batch) => categorized.push(...batch));
            });
            const categorizedComments = (0, sensemaker_utils_1.hydrateCommentRecord)(categorized, comments);
            console.log(`Categorization took ${(performance.now() - startTime) / (1000 * 60)} minutes.`);
            return categorizedComments;
        });
    }
}
exports.Sensemaker = Sensemaker;
class SensemakerPrompt {
    learnTopics(comments, includeSubtopics, topics, additionalInstructions) {
        const instructions = (0, topic_modeling_1.generateTopicModelingPrompt)(includeSubtopics, topics);
        // surround each comment by triple backticks to avoid model's confusion with single, double quotes and new lines
        const commentTexts = comments.map((comment) => "```" + comment.text + ` [${comment.id}]` + "```");
        // decide which schema to use based on includeSubtopics
        return (0, sensemaker_utils_1.getPrompt)(instructions, commentTexts, additionalInstructions);
    }
}
exports.SensemakerPrompt = SensemakerPrompt;
