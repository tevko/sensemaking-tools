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
exports.categorizeWithRetry = categorizeWithRetry;
exports.topicCategorizationPrompt = topicCategorizationPrompt;
exports.subtopicCategorizationPrompt = subtopicCategorizationPrompt;
exports.generateCategorizationPrompt = generateCategorizationPrompt;
exports.validateCommentRecords = validateCommentRecords;
exports.findMissingComments = findMissingComments;
const types_1 = require("../types");
const vertex_model_1 = require("../models/vertex_model");
const sensemaker_utils_1 = require("../sensemaker_utils");
const typebox_1 = require("@sinclair/typebox");
/**
 * @fileoverview Helper functions for performing comments categorization.
 */
/**
 * Makes API call to generate JSON and retries with any comments that were not properly categorized.
 * @param instructions Instructions for the LLM on how to categorize the comments.
 * @param inputComments The comments to categorize.
 * @param includeSubtopics Whether to include subtopics in the categorization.
 * @param topics The topics and subtopics provided to the LLM for categorization.
 * @param additionalInstructions - extra context to be included to the LLM prompt
 * @returns The categorized comments.
 */
function categorizeWithRetry(model, instructions, inputComments, includeSubtopics, topics, additionalInstructions) {
    return __awaiter(this, void 0, void 0, function* () {
        // a holder for uncategorized comments: first - input comments, later - any failed ones that need to be retried
        let uncategorized = [...inputComments];
        let categorized = [];
        for (let attempts = 1; attempts <= vertex_model_1.MAX_RETRIES; attempts++) {
            // convert JSON to string representation that will be sent to the model
            const uncategorizedCommentsForModel = uncategorized.map((comment) => JSON.stringify({ id: comment.id, text: comment.text }));
            const outputSchema = typebox_1.Type.Array(includeSubtopics ? types_1.SubtopicCategorizedComment : types_1.TopicCategorizedComment);
            const newCategorized = (yield model.generateData((0, sensemaker_utils_1.getPrompt)(instructions, uncategorizedCommentsForModel, additionalInstructions), outputSchema));
            const newProcessedComments = processCategorizedComments(newCategorized, inputComments, uncategorized, includeSubtopics, topics);
            categorized = categorized.concat(newProcessedComments.commentRecords);
            uncategorized = newProcessedComments.uncategorizedComments;
            if (uncategorized.length === 0) {
                break; // All comments categorized successfully
            }
            if (attempts < vertex_model_1.MAX_RETRIES) {
                console.warn(`Expected all ${uncategorizedCommentsForModel.length} comments to be categorized, but ${uncategorized.length} are not categorized properly. Retrying in ${vertex_model_1.RETRY_DELAY_MS / 1000} seconds...`);
                yield new Promise((resolve) => setTimeout(resolve, vertex_model_1.RETRY_DELAY_MS));
            }
            else {
                categorized = categorized.concat(assignDefaultCategory(uncategorized, includeSubtopics));
            }
        }
        return categorized;
    });
}
function topicCategorizationPrompt(topics) {
    return `
For each of the following comments, identify the most relevant topic from the list below.

Input Topics:
${JSON.stringify(topics)}

Important Considerations:
- Ensure the assigned topic accurately reflects the meaning of the comment.
- A comment can be assigned to multiple topics if relevant.
- Prioritize using the existing topics whenever possible.
- All comments must be assigned at least one existing topic.
- If no existing topic fits a comment well, assign it to the "Other" topic.
- Do not create any new topics that are not listed in the Input Topics.
`;
}
function subtopicCategorizationPrompt(topics) {
    return `
For each of the following comments, identify the most relevant topic and subtopic from the list below.

Input Topics and Subtopics (JSON formatted):
${JSON.stringify(topics)}

Important Considerations:
- Ensure the assignment of comments to subtopics is accurate and reflects the meaning of the comment.
- If comments relate to multiple topics, they should be added to each of the corresponding topics and their relevant subtopics.
- Prioritize assigning comments to existing subtopics whenever possible.
- All comments must be assigned to at least one existing topic and subtopic.
- If none of the provided topic–subtopic pairs accurately fit the comment, assign it to the 'Other' topic and its 'Other' subtopic.
- Do not create any new topics that are not listed in the Input Topics and Subtopics.
- Do not create any new subtopics that are not listed in the Input Topics and Subtopics.
`;
}
/**
 * Generates a prompt for an LLM to categorize comments based on a predefined set of topics (and subtopics).
 *
 * @param topics The user provided topics (and subtopic).
 * @param includeSubtopics Whether to include subtopics in the categorization.
 * @returns The generated prompt string, including instructions, output format, and considerations for categorization.
 */
function generateCategorizationPrompt(topics, includeSubtopics) {
    return includeSubtopics
        ? subtopicCategorizationPrompt(topics)
        : topicCategorizationPrompt(topics);
}
/**
 * Validates categorized comments, checking for:
 *  - Extra comments (not present in the original input)
 *  - Empty topics or subtopics
 *  - Invalid topic or subtopic names
 * @param commentRecords The categorized comments to validate.
 * @param inputComments The original input comments.
 * @param includeSubtopics Whether to include subtopics in the categorization.
 * @param topics The topics and subtopics provided to the LLM for categorization.
 * @returns An object containing:
 *  - `validCommentRecords`: comments that passed validation.
 *  - `commentsWithInvalidTopics`: comments that failed validation.
 */
function validateCommentRecords(commentRecords, inputComments, includeSubtopics, topics) {
    const commentsPassedValidation = [];
    const commentsWithInvalidTopics = [];
    // put all input comment ids together for output ids validation
    const inputCommentIds = new Set(inputComments.map((comment) => comment.id));
    // topic -> subtopics lookup for naming validation
    const topicLookup = createTopicLookup(topics);
    commentRecords.forEach((comment) => {
        if (isExtraComment(comment, inputCommentIds)) {
            return; // Skip to the next comment
        }
        if (hasEmptyTopicsOrSubtopics(comment, includeSubtopics)) {
            commentsWithInvalidTopics.push(comment);
            return; // Skip to the next comment
        }
        if (hasInvalidTopicNames(comment, includeSubtopics, topicLookup)) {
            commentsWithInvalidTopics.push(comment);
            return; // Skip to the next comment
        }
        // If all checks pass, add the comment to the valid ones
        commentsPassedValidation.push(comment);
    });
    return { commentsPassedValidation, commentsWithInvalidTopics };
}
/**
 * Creates a lookup table (dictionary) from an array of input Topic objects.
 * This table maps topic names to arrays of their corresponding subtopic names.
 *
 * @param inputTopics The array of Topic objects to create the lookup table from.
 * @returns A dictionary where keys are topic names (strings) and values are arrays of subtopic names (strings).
 *   If a topic has no subtopics, an empty array is used as the value to avoid dealing with undefined values.
 */
function createTopicLookup(inputTopics) {
    const lookup = {};
    for (const topic of inputTopics) {
        if ("subtopics" in topic) {
            lookup[topic.name] = topic.subtopics.map((subtopic) => subtopic.name);
        }
        else {
            lookup[topic.name] = [];
        }
    }
    return lookup;
}
/**
 * Checks if a comment is an extra comment (not present in the original input).
 * @param comment The categorized comment to check.
 * @param inputCommentIds An array of IDs of the original input comments.
 * @returns True if the comment is extra, false otherwise.
 */
function isExtraComment(comment, inputCommentIds) {
    if (!inputCommentIds.has(comment.id)) {
        console.warn(`Extra comment in model's response: ${JSON.stringify(comment)}`);
        return true;
    }
    return false;
}
/**
 * Checks if a comment has empty topics or subtopics.
 * @param comment The categorized comment to check.
 * @param includeSubtopics Whether to include subtopics in the categorization.
 * @returns True if the comment has empty topics or subtopics, false otherwise.
 */
function hasEmptyTopicsOrSubtopics(comment, includeSubtopics) {
    if (comment.topics.length === 0) {
        console.warn(`Comment with empty topics: ${JSON.stringify(comment)}`);
        return true;
    }
    if (includeSubtopics &&
        comment.topics.some((topic) => "subtopics" in topic && (!topic.subtopics || topic.subtopics.length === 0))) {
        console.warn(`Comment with empty subtopics: ${JSON.stringify(comment)}`);
        return true;
    }
    return false;
}
/**
 * Checks if a categorized comment has topic or subtopic names different from the provided ones to the LLM.
 * @param comment The categorized comment to check.
 * @param includeSubtopics Whether to include subtopics in the categorization.
 * @param inputTopics The lookup table mapping the input topic names to arrays of their subtopic names.
 * @returns True if the comment has invalid topic or subtopic names, false otherwise.
 */
function hasInvalidTopicNames(comment, includeSubtopics, inputTopics) {
    // We use `some` here to return as soon as we find an invalid topic (or subtopic).
    return comment.topics.some((topic) => {
        if (topic.name === "Other") {
            return false; // "Other" topic can have any subtopic names - we can skip checking them.
        }
        const isValidTopic = topic.name in inputTopics;
        if (!isValidTopic) {
            console.warn(`Comment has an invalid topic: ${topic.name}, comment: ${JSON.stringify(comment)}`);
            return true; // Invalid topic found, stop checking and return `hasInvalidTopicNames` true for this comment.
        }
        if (includeSubtopics && "subtopics" in topic) {
            const areAllSubtopicsValid = areSubtopicsValid(topic.subtopics, inputTopics[topic.name]);
            if (!areAllSubtopicsValid) {
                console.warn(`Comment has invalid subtopics under topic: ${topic.name}, comment: ${JSON.stringify(comment)}`);
                return true; // Invalid subtopics found, stop checking and return `hasInvalidTopicNames` true for this comment.
            }
        }
        // The current topic (and all its subtopics) is valid, go to the next one.
        return false;
    });
}
/**
 * Checks if an array of subtopics is valid against a list of valid subtopic names.
 * A subtopic is considered valid if its name is present in the input subtopics or if it's named "Other".
 *
 * @param subtopicsToCheck An array of subtopic objects, each having a 'name' property.
 * @param inputSubtopics An array of input subtopic names.
 * @returns True if all subtopics are valid, false otherwise.
 */
function areSubtopicsValid(subtopicsToCheck, inputSubtopics) {
    return subtopicsToCheck.every((subtopic) => inputSubtopics.includes(subtopic.name) || subtopic.name === "Other");
}
/**
 * Finds comments that are missing from the categorized output.
 * @param commentRecords The categorized comments received from the model.
 * @param uncategorized The current set of uncategorized comments to check if any are missing in the model response.
 * @returns An array of comments that were present in the input, but not in categorized.
 */
function findMissingComments(commentRecords, uncategorized) {
    const commentRecordIds = commentRecords.map((comment) => comment.id);
    const missingComments = uncategorized.filter((uncommentRecord) => !commentRecordIds.includes(uncommentRecord.id));
    if (missingComments.length > 0) {
        console.warn(`Missing comments in model's response: ${JSON.stringify(missingComments)}`);
    }
    return missingComments;
}
/**
 * Processes the categorized comments, validating them and updating the categorized and uncategorized arrays.
 *
 * @param commentRecords The newly categorized comments from the LLM.
 * @param inputComments The original input comments.
 * @param uncategorized The current set of uncategorized comments to check if any are missing in the model response.
 * @param includeSubtopics Whether to include subtopics in the categorization.
 * @param topics The topics and subtopics provided to the LLM for categorization.
 * @returns The successfully categorized comments and the unsuccessfully categorized comments with
 * the topics removed.
 */
function processCategorizedComments(commentRecords, inputComments, uncategorized, includeSubtopics, topics) {
    // Check for comments that were never in the input, have no topics, or non-matching topic names.
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(commentRecords, inputComments, includeSubtopics, topics);
    // Check for comments completely missing in the model's response
    const missingComments = findMissingComments(commentRecords, uncategorized);
    // Remove invalid topics from comments to prepare for retry.
    let invalidComments = (0, sensemaker_utils_1.hydrateCommentRecord)(commentsWithInvalidTopics, inputComments);
    invalidComments = invalidComments.map((comment) => {
        comment.topics = undefined;
        return comment;
    });
    // Combine all invalid comments for retry
    return {
        commentRecords: commentsPassedValidation,
        uncategorizedComments: [...missingComments, ...invalidComments],
    };
}
/**
 * Assigns the default "Other" topic and optionally "Uncategorized" subtopic to comments that
 * failed categorization.
 *
 * @param uncategorized The array of comments that failed categorization.
 * @param includeSubtopics whether to include the default subtopic
 * @returns the uncategorized comments now categorized into a "Other" category.
 */
function assignDefaultCategory(uncategorized, includeSubtopics) {
    console.warn(`Failed to categorize ${uncategorized.length} comments after maximum number of retries. Assigning "Other" topic and "Uncategorized" subtopic to failed comments.`);
    console.warn("Uncategorized comments:", JSON.stringify(uncategorized));
    return uncategorized.map((comment) => {
        return Object.assign(Object.assign({}, comment), { topics: [
                includeSubtopics
                    ? { name: "Other", subtopics: [{ name: "Uncategorized" }] }
                    : { name: "Other" },
            ] });
    });
}
