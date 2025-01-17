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

import { getPrompt } from "../../sensemaker_utils";
import { commentCitation } from "../../validation/grounding";
import {
  getGroupAgreeDifference,
  getGroupInformedConsensus,
  getMinAgreeProb,
  SummaryStats,
} from "../../stats_util";
import { RecursiveSummary, resolvePromisesInBatches } from "./recursive_summarization";
import { Comment, CommentWithVoteTallies, isCommentWithVoteTalliesType } from "../../types";

/**
 * Format a list of strings to be a human readable list ending with "and"
 * @param items the strings to concatenate
 * @returns a string with the format "<item>, <item>, and <item>"
 */
function formatStringList(items: string[]): string {
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
export class GroupsSummary extends RecursiveSummary {
  // The number of top comments to consider per section when summarizing.
  private topK = 5;
  // The minimum agree probability across groups to be considered a consensus statement.
  private minConsensusAgreeProb = 0.6;
  // The minimum agreement probability difference.
  private minAgreeProbDifference = 0.3;

  /**
   * Gets the topK agreed upon comments for a group.
   * @param groupName the group to consider agreement for
   * @returns the top comments as a list of strings
   */
  private getTopAgreeCommentsForGroup = (groupName: string): Comment[] =>
    this.filteredInput.topK((comment) => getGroupAgreeDifference(comment, groupName), this.topK);

  /**
   * Gets the topK agreed upon comments across all groups.
   *
   * This captures when the groups acted similarly, so it includes both when all the groups
   * agreed with something and when all the groups disagreed with something.
   * @returns the top agreed on comments
   */
  private getTopAgreeCommentsAcrossGroups(): Comment[] {
    const filteredComments = this.filteredInput.comments
      .filter(isCommentWithVoteTalliesType)
      .filter((comment: CommentWithVoteTallies) => {
        // Before using Group Informed Consensus a minimum bar of agreement must be enforced. The
        // absolute value is used to get when all groups agree with a comment OR all groups agree
        // that they don't agree with a comment.
        return Math.abs(getMinAgreeProb(comment)) >= this.minConsensusAgreeProb;
      });
    const filteredSummaryStats = new SummaryStats(filteredComments);
    return filteredSummaryStats.topK((comment) => getGroupInformedConsensus(comment), this.topK);
  }

  /**
   * Returns the top K comments that best distinguish differences of opinion between groups.
   *
   * This is computed as the difference in how likely each group is to agree with a given comment
   * as compared with the rest of the participant body.
   *
   * @returns the top disagreed on comments
   */
  private getTopDisagreeCommentsAcrossGroups(groupNames: string[]): Comment[] {
    const filteredComments = this.filteredInput.comments
      .filter(isCommentWithVoteTalliesType)
      .filter((comment: CommentWithVoteTallies) => {
        // Each the groups must disagree with the rest of the groups above an absolute
        // threshold before we consider taking the topK.
        for (const groupName of groupNames) {
          if (Math.abs(getGroupAgreeDifference(comment, groupName)) < this.minAgreeProbDifference) {
            return false;
          }
        }
        return true;
      });
    const filteredSummaryStats = new SummaryStats(filteredComments);
    return filteredSummaryStats.topK(
      // Get the maximum absolute group agree difference for any group.
      (comment) =>
        Math.max(
          ...groupNames.map((name: string) => {
            return Math.abs(getGroupAgreeDifference(comment, name));
          })
        ),
      this.topK
    );
  }

  /**
   * Describes what makes the groups similar and different.
   * @returns a two sentence description of similarities and differences.
   */
  private async getGroupComparison(groupNames: string[]): Promise<string> {
    const topAgreeCommentsAcrossGroups = this.getTopAgreeCommentsAcrossGroups();
    const groupComparisonSimilar = this.model.generateText(
      getPrompt(
        "Write one sentence describing what makes the different groups that had high inter group " +
          "agreement on this subset of comments. Frame it in terms of what the groups largely agree on.",
        topAgreeCommentsAcrossGroups.map((comment: Comment) => comment.text)
      )
    );

    const topDisagreeCommentsAcrossGroups = this.getTopDisagreeCommentsAcrossGroups(groupNames);
    const groupComparisonDifferent = this.model.generateText(
      getPrompt(
        "The following are comments that different groups had different opinions on. Write one sentence describing " +
          "what groups had different opinions on. Frame it in terms of what differs between the groups.",
        topDisagreeCommentsAcrossGroups.map((comment: Comment) => comment.text)
      )
    );

    // Combine the descriptions and add the comments used for summarization as citations.
    return Promise.resolve(groupComparisonSimilar)
      .then((result: string) => {
        return result + this.getCommentCitations(topAgreeCommentsAcrossGroups);
      })
      .then(async (similarResult: string) => {
        const differentResult = await Promise.resolve(groupComparisonDifferent);
        return (
          similarResult +
          " " +
          differentResult +
          this.getCommentCitations(topDisagreeCommentsAcrossGroups)
        );
      });
  }

  /**
   * Create citations for comments in the format of "[12, 43, 56]"
   * @param comments the comments to use for citations
   * @returns the formatted citations
   */
  private getCommentCitations(comments: Comment[]): string {
    return "[" + comments.map((comment) => commentCitation(comment)).join(", ") + "]";
  }

  /**
   * Returns a short description of all groups and a comparison of them.
   * @param groupNames the names of the groups to describe and compare
   * @returns text containing the description of each group and a compare and contrast section
   */
  private async getGroupDescriptions(groupNames: string[]): Promise<string> {
    const groupDescriptions = [];
    for (const groupName of groupNames) {
      const topCommentsForGroup = this.getTopAgreeCommentsForGroup(groupName);
      groupDescriptions.push(
        this.model
          .generateText(
            getPrompt(
              `Write a two sentence summary of ${groupName}. Focus on the groups' expressed` +
                ` views and opinions as reflected in the comments and votes, without speculating ` +
                `about demographics. Avoid politically charged language (e.g., "conservative," ` +
                `"liberal", or "progressive"). Instead, describe the group based on their ` +
                `demonstrated preferences within the conversation.`,
              topCommentsForGroup.map((comment: Comment) => comment.text)
            )
          )
          .then((result: string) => {
            return (
              `__${groupName}__: ` + result + this.getCommentCitations(topCommentsForGroup) + "\n"
            );
          })
      );
    }

    // TODO: These texts should have citations added. The comments used to generate them should be
    // used.
    // Join the individual group descriptions whenever they finish, and when that's done wait for
    // the group comparison to be created and combine them all together.
    return resolvePromisesInBatches([
      ...groupDescriptions,
      this.getGroupComparison(groupNames),
    ]).then((results: string[]) => {
      return results.join("\n");
    });
  }

  async getSummary() {
    const groupStats = this.filteredInput.getStatsByGroup();
    const groupCount = groupStats.length;
    const groupNamesWithQuotes = groupStats.map((stat) => {
      return `"${stat.name}"`;
    });
    const groupNames = groupStats.map((stat) => {
      return stat.name;
    });

    const groupSectionIntro =
      `## Opinion Groups\n\n` +
      `${groupCount} distinct groups (named here as ${formatStringList(groupNamesWithQuotes)}), ` +
      `emerged with differing viewpoints on several key issues. The groups are based on people who ` +
      `voted similarly to each other, and differently from the other group.\n\n`;
    const groupDescriptions = this.getGroupDescriptions(groupNames);

    const descriptionResult = await groupDescriptions;
    return groupSectionIntro + descriptionResult;
  }
}
