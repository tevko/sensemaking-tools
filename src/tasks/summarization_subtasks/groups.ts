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

import { getPrompt, formatCommentsWithVotes } from "../../sensemaker_utils";
import { getGroupAgreeDifference } from "../../stats_util";
import { RecursiveSummary } from "./recursive_summarization";
import { Comment } from "../../types";

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
  private topK = 12;

  /**
   * Describes what makes the groups similar and different.
   * @returns a two sentence description of similarities and differences.
   */
  private async getGroupComparison(): Promise<string> {
    const groupComparisonSimilar = this.model.generateText(
      getPrompt(
        "Write one sentence describing what makes the voting groups similar based on their demonstrated preferences within the conversation.",
        // TODO: Take top K cross group agreement comments
        formatCommentsWithVotes(this.input.comments)
      )
    );

    const groupComparisonDifferent = this.model.generateText(
      getPrompt(
        "Write one sentence describing what makes the voting groups different based on their demonstrated preferences within the conversation.",
        // TODO: Take top K cross group disagreement comments
        formatCommentsWithVotes(this.input.comments)
      )
    );

    return Promise.all([groupComparisonSimilar, groupComparisonDifferent]).then(
      (results: string[]) => {
        return results.join(" ");
      }
    );
  }

  /**
   * Returns a short description of all groups and a comparison of them.
   * @param groupNames the names of the groups to describe and compare
   * @returns text containing the description of each group and a compare and contrast section
   */
  private async getGroupDescriptions(groupNames: string[]): Promise<string> {
    const groupDescriptions = [];
    for (const groupName of groupNames) {
      const topAgreeCommentsForGroup = this.input
        .topK((comment) => getGroupAgreeDifference(comment, groupName), this.topK)
        .map((comment: Comment) => {
          return comment.text;
        });
      groupDescriptions.push(
        this.model
          .generateText(
            getPrompt(
              `Write a two sentence summary of ${groupName}. Focus on the groups' expressed` +
                ` views and opinions as reflected in the comments and votes, without speculating ` +
                `about demographics. Avoid politically charged language (e.g., "conservative," ` +
                `"liberal", or "progressive"). Instead, describe the group based on their ` +
                `demonstrated preferences within the conversation.`,
              topAgreeCommentsForGroup
            )
          )
          .then((result: string) => {
            return `__${groupName}__: ` + result;
          })
      );
    }

    // TODO: These texts should have citations added. The comments used to generate them should be
    // used.
    // Join the individual group descriptions whenever they finish, and when that's done wait for
    // the group comparison to be created and combine them all together.
    return Promise.all([...groupDescriptions, this.getGroupComparison()]).then(
      (results: string[]) => {
        return results.join("\n");
      }
    );
  }

  async getSummary() {
    const groupStats = this.input.getStatsByGroup();
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
