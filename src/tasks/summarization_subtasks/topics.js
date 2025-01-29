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
exports.SubtopicSummary = exports.TopicSummary = exports.TopicsSummary = void 0;
// Functions for different ways to summarize Comment and Vote data.
const recursive_summarization_1 = require("./recursive_summarization");
const stats_util_1 = require("../../stats_util");
const sensemaker_utils_1 = require("../../sensemaker_utils");
const citation_utils_1 = require("../utils/citation_utils");
const commonGroundInstructions = `Here are several comments sharing different opinions. Your job is to summarize these comments. Do not pretend that you hold any of these opinions. You are not a participant in this discussion. Participants in this conversation have been clustered into opinion groups. These opinion groups mostly approve of these comments. Write a concise summary of these comments that is at least one sentence and at most three sentences long. The summary should be substantiated, detailed and informative: include specific findings, requests, proposals, action items and examples, grounded in the comments. Refer to the people who made these comments as participants, not commenters. Do not talk about how strongly they approve of these comments. Use complete sentences. Do not use the passive voice. Do not use ambiguous pronouns. Be clear. Do not generate bullet points or special formatting. Do not yap.`;
const commonGroundSingleCommentInstructions = `Here is a comment presenting an opinion from a discussion. Your job is to rewrite this comment clearly without embellishment. Do not pretend that you hold this opinion. You are not a participant in this discussion. Participants in this conversation have been clustered into opinion groups. These opinion groups mostly approve of this comment. Refer to the people who made these comments as participants, not commenters. Do not talk about how strongly they approve of these comments. Write a complete sentence. Do not use the passive voice. Do not use ambiguous pronouns. Be clear. Do not generate bullet points or special formatting. Do not yap.`;
const differencesOfOpinionInstructions = `Here are several comments which generated disagreement. Your job is summarize the ideas contained in the comments. Do not pretend that you hold any of these opinions. You are not a participant in this discussion. Write a concise summary of these comments that is at least one sentence and at most three sentences long. Refer to the people who made these comments as participants, not commenters.  Do not talk about how strongly they disagree on these comments. Use complete sentences. Do not use the passive voice. Do not use ambiguous pronouns. Be clear. Do not generate bullet points or special formatting. The summary should not imply that these views were agreed on by all participants. Your output should begin in the form "There was low consensus". Do not pretend that these comments were written by different people.  For each sentence use a unique phrase to indicate that there was low consensus on the topic, and do not present each comment as an alternative idea. Do not yap.`;
const differencesOfOpinionSingleCommentInstructions = `Here is a comment presenting an opinion from a discussion. Your job is to rewrite this comment clearly without embellishment. Do not pretend that you hold this opinion. You are not a participant in this discussion. Participants in this conversation have been clustered into opinion groups. There were very different levels of agreement between the two opinion groups regarding this comment. Refer to the people who made these comments as participants, not commenters. Do not talk about how strongly they approve of these comments. Write a complete sentence. Do not use the passive voice. Do not use ambiguous pronouns. Be clear. Do not generate bullet points or special formatting. Do not yap.`;
/**
 * This RecursiveSummary subclass constructs a top level "Topics" summary section,
 * calling out to the separate TopicSummary and SubtopicSummary classes to generate
 * content for individual subsections corresponding to specific topics and subtopics.
 */
class TopicsSummary extends recursive_summarization_1.RecursiveSummary {
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            // First construct the introductory description for the entire section
            const topicStats = this.input.getStatsByTopic();
            const nTopics = topicStats.length;
            const nSubtopics = topicStats
                .map((t) => { var _a; return ((_a = t.subtopicStats) === null || _a === void 0 ? void 0 : _a.length) || 0; })
                .reduce((n, m) => n + m, 0);
            const hasSubtopics = nSubtopics > 0;
            const subtopicsCountText = hasSubtopics ? `, as well as ${nSubtopics} subtopics` : "";
            const overviewText = `From the comments submitted, ${nTopics} high level topics were identified${subtopicsCountText}. ` +
                `Based on voting patterns between the opinion groups described above, both points of common ground as well as differences of opinion between the groups have been identified and are described below.`;
            // Now construct the individual Topic summaries
            const topicSummaries = topicStats.map((topicStat) => new TopicSummary(topicStat, this.model, this.additionalContext).getSummary());
            const topicSummaryText = yield (0, recursive_summarization_1.resolvePromisesInParallel)(topicSummaries).then((summaries) => summaries.join("\n"));
            return Promise.resolve(`## Topics

${overviewText}

${topicSummaryText}
`);
        });
    }
}
exports.TopicsSummary = TopicsSummary;
/**
 * This RecursiveSummary subclass generates summaries for individual topics.
 */
class TopicSummary extends recursive_summarization_1.RecursiveSummary {
    // This override is necessary to pass through a TopicStat object, rather than a SummaryStats object
    constructor(topicStat, model, additionalContext) {
        const commentStats = new stats_util_1.GroupedSummaryStats(topicStat.comments);
        super(commentStats, model, additionalContext);
        this.topicStat = topicStat;
    }
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const nSubtopics = ((_a = this.topicStat.subtopicStats) === null || _a === void 0 ? void 0 : _a.length) || 0;
            if (nSubtopics == 0) {
                return this.getCommentSummary();
            }
            else {
                return this.getSubtopicsSummary();
            }
        });
    }
    /**
     * Returns the section title for this topics summary section of the final report
     */
    getSectionTitle() {
        return `### ${this.topicStat.name} (${this.topicStat.commentCount} comments)`;
    }
    /**
     * When subtopics are present, compiles the individual summaries for those subtopics
     * @returns a promise of the summary string
     */
    getSubtopicsSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const subtopicSummaries = ((_a = this.topicStat.subtopicStats) === null || _a === void 0 ? void 0 : _a.map((subtopicStat) => new SubtopicSummary(subtopicStat, this.model, this.additionalContext).getSummary())) || [];
            const subtopicsSummaryText = yield (0, recursive_summarization_1.resolvePromisesInParallel)(subtopicSummaries).then((summaries) => summaries.join("\n"));
            // This is just a stub for now, and may eventually be added on to include more naunced descriptions of e.g. where the highest
            // points of common ground and most significant differences of opinion were across the subtopics.
            const nSubtopics = ((_b = this.topicStat.subtopicStats) === null || _b === void 0 ? void 0 : _b.length) || 0;
            const topicSummary = nSubtopics > 0
                ? `This topic included ${nSubtopics} subtopic${nSubtopics === 1 ? "" : "s"}.`
                : "";
            return Promise.resolve(`${this.getSectionTitle()}

${topicSummary}

${subtopicsSummaryText}
`);
        });
    }
    /**
     * Summarizes the comments associated with the given topic
     * @returns a promise of the summary string
     */
    getCommentSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const groupStats = this.input.getStatsByGroup();
            const groupNames = groupStats.map((stat) => {
                return stat.name;
            });
            const commonGroundSummary = yield this.getCommonGroundSummary();
            const differencesSummary = yield this.getDifferencesOfOpinionSummary(groupNames);
            return Promise.resolve(`${this.getSectionTitle()}

Common ground between groups: ${commonGroundSummary}

Differences of opinion: ${differencesSummary}
`);
        });
    }
    /**
     * Summarizes the comments on which there was the strongest agreement between groups.
     * @returns a short paragraph describing the similarities between groups, including comment citations.
     */
    getCommonGroundSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const commonGroundComments = this.input.getCommonGroundComments();
            const nComments = commonGroundComments.length;
            if (nComments === 0) {
                return `No comments met the thresholds necessary to be considered as a point of common ground (at least ${this.input.minVoteCount} votes, and at least ${(0, sensemaker_utils_1.decimalToPercent)(this.input.minAgreeProbCommonGround)} agreement across groups).`;
            }
            else {
                const summary = this.model.generateText((0, sensemaker_utils_1.getPrompt)(nComments === 1 ? commonGroundSingleCommentInstructions : commonGroundInstructions, commonGroundComments.map((comment) => comment.text), this.additionalContext));
                return (yield summary) + (0, citation_utils_1.getCommentCitations)(commonGroundComments);
            }
        });
    }
    /**
     * Summarizes the comments on which there was the strongest disagreement between groups.
     * @returns a short paragraph describing the differences between groups, including comment citations.
     */
    getDifferencesOfOpinionSummary(groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const topDisagreeCommentsAcrossGroups = this.input.getDifferencesBetweenGroupsComments(groupNames);
            const nComments = topDisagreeCommentsAcrossGroups.length;
            if (nComments === 0) {
                return `No comments met the thresholds necessary to be considered as a significant difference of opinion (at least ${this.input.minVoteCount} votes, and more than ${(0, sensemaker_utils_1.decimalToPercent)(this.input.minAgreeProbDifference)} difference in agreement rate between groups).`;
            }
            else {
                const summary = this.model.generateText((0, sensemaker_utils_1.getPrompt)(nComments === 1
                    ? differencesOfOpinionSingleCommentInstructions
                    : differencesOfOpinionInstructions, topDisagreeCommentsAcrossGroups.map((comment) => comment.text), this.additionalContext));
                return (yield summary) + (0, citation_utils_1.getCommentCitations)(topDisagreeCommentsAcrossGroups);
            }
        });
    }
}
exports.TopicSummary = TopicSummary;
/**
 * This TopicSummary subclass contains overrides for subtopics. At present, this is just an
 * override for the section title, but may evolve to different on other functionality.
 */
class SubtopicSummary extends TopicSummary {
    getSectionTitle() {
        return `#### ${this.topicStat.name} (${this.topicStat.commentCount} comments)`;
    }
}
exports.SubtopicSummary = SubtopicSummary;
