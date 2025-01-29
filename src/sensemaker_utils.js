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
exports.retryCall = retryCall;
exports.getPrompt = getPrompt;
exports.formatCommentsWithVotes = formatCommentsWithVotes;
exports.hydrateCommentRecord = hydrateCommentRecord;
exports.groupCommentsBySubtopic = groupCommentsBySubtopic;
exports.decimalToPercent = decimalToPercent;
const vertex_model_1 = require("./models/vertex_model");
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
function retryCall(func_1, isValid_1, maxRetries_1, errorMsg_1) {
    return __awaiter(this, arguments, void 0, function* (func, isValid, maxRetries, errorMsg, retryDelayMS = vertex_model_1.RETRY_DELAY_MS, funcArgs, isValidArgs) {
        /* eslint-enable  @typescript-eslint/no-explicit-any */
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = yield func(...funcArgs);
                if (isValid(response, ...isValidArgs)) {
                    return response;
                }
                console.error(`Attempt ${attempt} failed. Invalid response:`, response);
            }
            catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);
            }
            console.log(`Retrying in ${retryDelayMS / 1000} seconds`);
            yield new Promise((resolve) => setTimeout(resolve, retryDelayMS));
        }
        throw new Error(`Failed after ${maxRetries} attempts: ${errorMsg}`);
    });
}
/**
 * Combines the data and instructions into a prompt to send to Vertex.
 * @param instructions: what the model should do.
 * @param data: the data that the model should consider.
 * @param additionalContext additional context to include in the prompt.
 * @returns the instructions and the data as a text
 */
function getPrompt(instructions, data, additionalContext) {
    return `
<instructions>
  ${instructions}
</instructions>
${additionalContext ? "\n<additionalContext>\n  " + additionalContext + "\n</additionalContext>\n" : ""}
<data>
  <comment>${data.join("</comment>\n  <comment>")}</comment>
</data>`;
}
/**
 * Utility function for formatting the comments together with vote tally data
 * @param commentData: the data to summarize, as an array of Comment objects
 * @returns: comments, together with vote tally information as JSON
 */
function formatCommentsWithVotes(commentData) {
    return commentData.map((comment) => comment.text + "\n      vote info per group: " + JSON.stringify(comment.voteTalliesByGroup));
}
/**
 * Converts the given commentRecords to Comments.
 * @param commentRecords what to convert to Comments
 * @param missingTexts the original comments with IDs match the commentRecords
 * @returns a list of Comments with all possible fields from commentRecords.
 */
function hydrateCommentRecord(commentRecords, missingTexts) {
    const inputCommentsLookup = new Map(missingTexts.map((comment) => [comment.id, comment]));
    return commentRecords
        .map((commentRecord) => {
        // Combine the matching Comment with the topics from the CommentRecord.
        const comment = inputCommentsLookup.get(commentRecord.id);
        if (comment) {
            comment.topics = commentRecord.topics;
        }
        return comment;
    })
        .filter((comment) => {
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
function groupCommentsBySubtopic(categorized) {
    const groupedComments = {};
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
 * Format a decimal number as a percent string with the given precision
 * @param decimal The decimal number to convert
 * @param precision The precision
 * @returns A string representing the equivalent percentage
 */
function decimalToPercent(decimal, precision = 0) {
    const percentage = decimal * 100;
    const roundedPercentage = Math.round(percentage * 10 ** precision) / 10 ** precision;
    return `${roundedPercentage}%`;
}
