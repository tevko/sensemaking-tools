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
exports.GroupsSummary = void 0;
const sensemaker_utils_1 = require("../../sensemaker_utils");
const recursive_summarization_1 = require("./recursive_summarization");
const citation_utils_1 = require("../utils/citation_utils");
/**
 * Format a list of strings to be a human readable list ending with "and"
 * @param items the strings to concatenate
 * @returns a string with the format "<item>, <item>, and <item>"
 */
function formatStringList(items) {
    if (items.length === 0) {
        return "";
    }
    if (items.length === 1) {
        return items[0];
    }
    if (items.length === 2) {
        return `${items[0]} and ${items[1]}`;
    }
    const lastItem = items.pop(); // Remove the last item
    return `${items.join(", ")} and ${lastItem}`;
}
/**
 * A summary section that describes the groups in the data and the similarities/differences between
 * them.
 */
class GroupsSummary extends recursive_summarization_1.RecursiveSummary {
    /**
     * Describes what makes the groups similar and different.
     * @returns a two sentence description of similarities and differences.
     */
    getGroupComparison(groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const topAgreeCommentsAcrossGroups = this.input.getCommonGroundComments();
            const groupComparisonSimilar = this.model.generateText((0, sensemaker_utils_1.getPrompt)(`Write one sentence describing the views of the ${groupNames.length} different opinion ` +
                "groups that had high inter group agreement on this subset of comments. Frame it in " +
                "terms of what the groups largely agree on.", topAgreeCommentsAcrossGroups.map((comment) => comment.text), this.additionalContext));
            const topDisagreeCommentsAcrossGroups = this.input.getDifferencesBetweenGroupsComments(groupNames);
            const groupComparisonDifferent = this.model.generateText((0, sensemaker_utils_1.getPrompt)("The following are comments that different groups had different opinions on. Write one sentence describing " +
                "what groups had different opinions on. Frame it in terms of what differs between the " +
                "groups. Do not suggest the groups agree on these issues. Include every comment in the summary.", topDisagreeCommentsAcrossGroups.map((comment) => comment.text), this.additionalContext));
            // Combine the descriptions and add the comments used for summarization as citations.
            return Promise.resolve(groupComparisonSimilar)
                .then((result) => {
                return result + (0, citation_utils_1.getCommentCitations)(topAgreeCommentsAcrossGroups);
            })
                .then((similarResult) => __awaiter(this, void 0, void 0, function* () {
                const differentResult = yield Promise.resolve(groupComparisonDifferent);
                return (similarResult +
                    " " +
                    differentResult +
                    (0, citation_utils_1.getCommentCitations)(topDisagreeCommentsAcrossGroups));
            }));
        });
    }
    /**
     * Returns a short description of all groups and a comparison of them.
     * @param groupNames the names of the groups to describe and compare
     * @returns text containing the description of each group and a compare and contrast section
     */
    getGroupDescriptions(groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupDescriptions = [];
            for (const groupName of groupNames) {
                const topCommentsForGroup = this.input.getGroupRepresentativeComments(groupName);
                groupDescriptions.push(this.model
                    .generateText((0, sensemaker_utils_1.getPrompt)(`Write a two sentence summary of ${groupName}. Focus on the groups' expressed` +
                    ` views and opinions as reflected in the comments and votes, without speculating ` +
                    `about demographics. Avoid politically charged language (e.g., "conservative," ` +
                    `"liberal", or "progressive"). Instead, describe the group based on their ` +
                    `demonstrated preferences within the conversation.`, topCommentsForGroup.map((comment) => comment.text), this.additionalContext))
                    .then((result) => {
                    return `__${groupName}__: ` + result + (0, citation_utils_1.getCommentCitations)(topCommentsForGroup) + "\n";
                }));
            }
            // Join the individual group descriptions whenever they finish, and when that's done wait for
            // the group comparison to be created and combine them all together.
            return (0, recursive_summarization_1.resolvePromisesInParallel)([
                ...groupDescriptions,
                this.getGroupComparison(groupNames),
            ]).then((results) => {
                return results.join("\n");
            });
        });
    }
    /**
     * Summarize each comment as a separate bullet point.
     * @param comments the comments to summarize.
     * @returns the HTML elements for a bullet point list of summaries, includes citations.
     */
    getBulletPointSummary(comments) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, recursive_summarization_1.resolvePromisesInParallel)(comments.map((comment) => __awaiter(this, void 0, void 0, function* () {
                return ("<li>" +
                    (yield this.model.generateText((0, sensemaker_utils_1.getPrompt)("Write a bullet point length summary of the following comment. Do not format it like a bullet point.", [comment.text]))) +
                    (0, citation_utils_1.commentCitationHtml)(comment) +
                    `</li>\n`);
            }))).then((results) => {
                return results.join(" ");
            });
        });
    }
    /**
     * Generates a table describing what makes groups similar and different.
     * @param groupNames the groups to include
     * @returns a table with two columns, one for group agreement and one for group disagreement.
     */
    getGroupTableBreakdown(groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: To make sure the summaries aren't almost identical the comments should all come from
            // different subtopics or topics.
            const topAgreeCommentsAcrossGroups = this.input.getCommonGroundComments(3);
            const topDisagreeCommentsAcrossGroups = this.input.getDifferencesBetweenGroupsComments(groupNames, 3);
            return (`<table>
  <thead>
    <tr>
      <th style="border-right: 1px solid black; padding: 10px;"> Common Ground Between All Groups </th>
      <th style="padding: 10px;"> Points of Contention Between All Groups </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border-right: 1px solid black;">
        <ul>` +
                (yield this.getBulletPointSummary(topAgreeCommentsAcrossGroups)) +
                `</ul>
      </td>
      <td>
        <ul>` +
                (yield this.getBulletPointSummary(topDisagreeCommentsAcrossGroups)) +
                `</ul>
      </td>
    </tr>
  </tbody>
</table>

<style>
  table {
    border-collapse: collapse; 
    border: 1px solid black; 
  }
  th, td {
    border: none; /* Remove cell borders */
    border-bottom: 1px solid black; /* Add a line below header and above rows */ 
  }
</style>`);
        });
    }
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const groupStats = this.input.getStatsByGroup();
            const groupCount = groupStats.length;
            const groupNamesWithQuotes = groupStats.map((stat) => {
                return `"${stat.name}"`;
            });
            const groupNames = groupStats.map((stat) => {
                return stat.name;
            });
            const groupSectionIntro = `## Opinion Groups\n\n` +
                `${groupCount} distinct groups (named here as ${formatStringList(groupNamesWithQuotes)}) ` +
                `emerged with differing viewpoints in relation to the submitted comments. The groups are ` +
                `based on people who tend to vote more similarly to each other than to those outside the group. ` +
                "However there are points of common ground where the groups voted similarly.\n\n";
            const groupDescriptions = this.getGroupDescriptions(groupNames);
            const descriptionResult = yield groupDescriptions;
            const groupTable = yield this.getGroupTableBreakdown(groupNames);
            return groupSectionIntro + descriptionResult + "\n" + groupTable;
        });
    }
}
exports.GroupsSummary = GroupsSummary;
