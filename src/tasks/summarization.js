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
exports.MultiStepSummary = void 0;
exports._getIntroText = _getIntroText;
exports.getSummarizationInstructions = getSummarizationInstructions;
exports.summarizeByType = summarizeByType;
exports.basicSummarize = basicSummarize;
exports.voteTallySummarize = voteTallySummarize;
exports.retryGenerateSummary = retryGenerateSummary;
exports._quantifyTopicNames = _quantifyTopicNames;
const types_1 = require("../types");
const sensemaker_utils_1 = require("../sensemaker_utils");
const vertex_model_1 = require("../models/vertex_model");
const intro_1 = require("./summarization_subtasks/intro");
const groups_1 = require("./summarization_subtasks/groups");
const topics_1 = require("./summarization_subtasks/topics");
const conclusion_1 = require("./summarization_subtasks/conclusion");
/**
 * Create an intro paragraph formatted in markdown with statistics.
 *
 * @param commentCount the number of comments in the conversation
 * @param voteCount the number of votes in the conversation
 * @param quantifiedTopics the topics and subtopics with the comment count information and ordered
 * by size
 * @returns a intro paragraph in markdown
 */
function _getIntroText(commentCount, voteCount, quantifiedTopics) {
    const commentCountFormatted = commentCount.toLocaleString();
    const voteCountFormatted = voteCount.toLocaleString();
    let text = `This report summarizes the results of public input, encompassing ` +
        `__${commentCountFormatted} comments__ and ` +
        `${voteCount > 0 ? `__${voteCountFormatted} votes__` : ""}. All voters were anonymous. The ` +
        `public input collected covered a wide range of topics and subtopics, including:\n`;
    for (const topicName in quantifiedTopics) {
        text += " * __" + topicName + "__\n";
        const subtopicNames = quantifiedTopics[topicName];
        const subtopicText = "     * " + subtopicNames.join(", ") + "\n";
        // Remove the substring "comments" from the list of subtopics for conciseness.
        text += subtopicText.replace(/ comments/g, "");
    }
    return text;
}
function getSummarizationInstructions(includeGroups, summaryStats) {
    // Prepare statistics like vote count and number of comments per topic for injecting in prompt as
    // well as sorts topics based on count.
    const topicStats = summaryStats.getStatsByTopic();
    const quantifiedTopics = _quantifyTopicNames(topicStats);
    const introText = _getIntroText(summaryStats.commentCount, summaryStats.voteCount, quantifiedTopics);
    return `You’re analyzing the results of a public conversation on a topic. It contains comments and associated votes.
You will summarize with the summary having all of the following categories and subcategories:

${JSON.stringify(quantifiedTopics, null, 2)}

Use categories or subcategories names exactly as they are provided (for example: "Topic Name (10 comments)").

Your task is to write a summary for each section, taking into account the opinions of the groups, including minority viewpoints.

First explain the perspectives of each group, highlighting common ground and points of division.
- If vote tallies per each group are included in the comment data, pay attention to not just the content of the comments in relation to the summary claims, but also to whether the claims accurately reflect the vote breakdown by each group.
- If there is a group with high number of disagree votes on the claim, do not state that there is strong or widespread support or high consensus. You goal is to avoid misrepresentation of group's opinion based on the group's votes.
Then, for areas of disagreement, analyze comments to see if there's a solution backed by the comments, that can be served as a common ground endorsed by all groups. Do not suggest any novel ideas not grounded in the comments.
Finally, rewrite the section summary incorporating the common ground and divisions with potential solutions grounded in the comments.
The new summary should be substantiated, detailed and informative: include specific findings, requests, proposals, action items and examples, grounded in the conversation comments.

Do not generate:
- Generic summaries (e.g., "There was discussion about ...")
- Broad statements lacking specific details (e.g., "In many areas, ..."")
Do not include group vote tallies in the summary.
Do not crop the response; include all sections of the conversation.

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

Please use this text for the Intro section: ${introText}

If group vote data is available, include a one-paragraph section describing the voting groups, using the provided group names. Focus on the groups' expressed views and opinions as reflected in the comments and votes, without speculating about demographics. Avoid politically charged classifications (e.g., "conservative," "liberal", or "progressive"). Instead, describe each group based on their demonstrated preferences within the conversation (e.g., "Group A favored X, while Group B prioritized Y"). Frame the entire summary around the perspectives of these groups, indicating for each claim whether the groups agree or disagree.

Within the high/low consensus summary list out the specific issues and make them bold (by wrapping them in double asterisks "**"), e.g. "**Developing the riverfront**", to make those proposals more clear and help spot the relative priority or consensus of specific issues more easily at a glance.
`;
}
/**
 * Summarizes comments based on the specified summarization type.
 *
 * @param model The language model to use for summarization.
 * @param comments An array of `Comment` objects containing the comments to summarize.
 * @param summarizationType The type of summarization to perform (e.g., BASIC, VOTE_TALLY).
 * @param additionalContext Optional additional instructions to guide the summarization process. These instructions will be included verbatim in the prompt sent to the LLM.
 * @returns A Promise that resolves to the generated summary string.
 * @throws {TypeError} If an unknown `summarizationType` is provided.
 */
function summarizeByType(model, summaryStats, summarizationType, additionalContext) {
    return __awaiter(this, void 0, void 0, function* () {
        if (summarizationType === types_1.SummarizationType.BASIC) {
            return yield basicSummarize(summaryStats, model, additionalContext);
        }
        else if (summarizationType === types_1.SummarizationType.VOTE_TALLY) {
            return yield voteTallySummarize(summaryStats, model, additionalContext);
        }
        else if (summarizationType === types_1.SummarizationType.MULTI_STEP) {
            return yield new MultiStepSummary(summaryStats, model, additionalContext).getSummary();
        }
        else {
            throw new TypeError("Unknown Summarization Type.");
        }
    });
}
/**
 *
 */
class MultiStepSummary {
    constructor(summaryStats, model, additionalContext) {
        this.summaryStats = summaryStats;
        this.model = model;
        this.additionalContext = additionalContext;
    }
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const introSummary = yield new intro_1.IntroSummary(this.summaryStats, this.model, this.additionalContext).getSummary();
            const groupsSummary = yield new groups_1.GroupsSummary(this.summaryStats, this.model, this.additionalContext).getSummary();
            const topicsSummary = yield new topics_1.TopicsSummary(this.summaryStats, this.model, this.additionalContext).getSummary();
            const conclusionSummary = yield new conclusion_1.ConclusionSummary(this.summaryStats, this.model, this.additionalContext).getSummary();
            // return a concatenation of the separate sections, with two newlines separating each section
            return (introSummary + "\n\n" + groupsSummary + "\n\n" + topicsSummary + "\n\n" + conclusionSummary);
        });
    }
}
exports.MultiStepSummary = MultiStepSummary;
/**
 * Summarizes the comments using a LLM on Vertex.
 * @param instructions: how the comments should be summarized.
 * @param comments: the data to summarize
 * @param additionalContext: additional context to include in the prompt.
 * @returns: the LLM's summarization.
 */
function basicSummarize(summaryStats, model, additionalContext) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = (0, sensemaker_utils_1.getPrompt)(getSummarizationInstructions(false, summaryStats), summaryStats.comments.map((c) => c.text), additionalContext);
        return retryGenerateSummary(model, prompt);
    });
}
/**
 * Summarizes the comments using a LLM on Vertex.
 * @param instructions: how the comments should be summarized.
 * @param commentData: the data to summarize, as an array of Comment objects
 * @param additionalContext: additional context to include in the prompt.
 * @returns: the LLM's summarization.
 */
function voteTallySummarize(summaryStats, model, additionalContext) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = (0, sensemaker_utils_1.getPrompt)(getSummarizationInstructions(true, summaryStats), (0, sensemaker_utils_1.formatCommentsWithVotes)(summaryStats.comments), additionalContext);
        return retryGenerateSummary(model, prompt);
    });
}
/**
 * Helper function to encapsulate the retry logic.
 *
 * @param model The LLM to use for summarization.
 * @param prompt The prompt to provide to the LLM.
 * @returns A Promise that resolves to the generated summary string, or rejects with an error if a valid summary could not be generated after multiple retries.
 */
function retryGenerateSummary(model, prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, sensemaker_utils_1.retryCall)(
        // LLM call
        (model, prompt) => __awaiter(this, void 0, void 0, function* () { return model.generateText(prompt); }), 
        // summary validation function
        (summary) => {
            return (summary.includes("## Conclusion") &&
                !summary.includes("]],^[") && // punctuation should be within brackets, like: ",]]^["
                !summary.includes("]].^["));
        }, vertex_model_1.MAX_RETRIES, "Generated summary is incomplete or has incorrect formatting.", undefined, // no retry delay needed here, as the LLM call take some time anyway
        [model, prompt], // arguments for the LLM call
        [] // no additional arguments for the validation - the summary is passed automatically
        );
    });
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
function _quantifyTopicNames(topics) {
    const result = {};
    for (const topic of topics) {
        const topicName = `${topic.name} (${topic.commentCount} comments)`;
        if (topic.subtopicStats) {
            result[topicName] = topic.subtopicStats.map((subtopic) => `${subtopic.name} (${subtopic.commentCount} comments)`);
        }
    }
    return result;
}
