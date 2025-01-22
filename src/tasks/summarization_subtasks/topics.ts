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

import { RecursiveSummary, resolvePromisesInParallel } from "./recursive_summarization";
import { TopicStats, GroupedSummaryStats, GroupStats } from "../../stats_util";
import { getPrompt, getCommentCitations } from "../../sensemaker_utils";
import { Comment } from "../../types";

const commonGroundInstructions = `Here are several comments sharing different opinions. Your job is to summarize these comments. Do not pretend that you hold any of these opinions. You are not a participant in this discussion. Participants in this conversation have been clustered into opinion groups. These opinion groups mostly approve of these comments. Write a concise summary of these comments that is at least one sentence and at most three sentences long. The summary should be substantiated, detailed and informative: include specific findings, requests, proposals, action items and examples, grounded in the comments. Refer to the people who made these comments as participants, not commenters. Do not talk about how strongly they approve of these comments. Use complete sentences. Do not use the passive voice. Do not use ambiguous pronouns. Be clear. Do not generate bullet points or special formatting. Do not yap.`;

const differencesOfOpinionInstructions = `Here are several comments which generated disagreement. Your job is summarize the ideas contained in the comments. Do not pretend that you hold any of these opinions. You are not a participant in this discussion. Write a concise summary of these comments that is at least one sentence and at most three sentences long. Refer to the people who made these comments as participants, not commenters.  Do not talk about how strongly they disagree on these comments. Use complete sentences. Do not use the passive voice. Do not use ambiguous pronouns. Be clear. Do not generate bullet points or special formatting. The summary should not imply that these views were agreed on by all participants. Your output should begin in the form "There was low consensus". Do not pretend that these comments were written by different people.  For each sentence use a unique phrase to indicate that there was low consensus on the topic, and do not present each comment as an alternative idea. Do not yap.`;

export class TopicsSummary extends RecursiveSummary<GroupedSummaryStats> {
  async getSummary() {
    // First construct the introductory description for the entire section
    const topicStats: TopicStats[] = this.input.getStatsByTopic();
    const nTopics: number = topicStats.length;
    const nSubtopics: number = topicStats
      .map((t) => t.subtopicStats?.length || 0)
      .reduce((n, m) => n + m, 0);
    const hasSubtopics: boolean = nSubtopics > 0;
    const subtopicsCountText: string = hasSubtopics ? `, as well as ${nSubtopics} subtopics` : "";
    const overviewText: string =
      `From the comments submitted, ${nTopics} high level topics were identified${subtopicsCountText}. ` +
      `Based on voting patterns between the opinion groups described above, both points of common ground as well as differences of opinion between the groups have been identified and are described below.`;

    // Now construct the individual Topic summaries
    const topicSummaries: Array<Promise<string>> = topicStats.map((topicStat) =>
      this.getTopicSummary(topicStat)
    );
    const topicSummaryText: string = await resolvePromisesInParallel(topicSummaries).then(
      (summaries) => summaries.join("\n")
    );

    return Promise.resolve(
      `## Topics

${overviewText}

${topicSummaryText}
`
    );
  }

  /**
   * Generate a summary for the given topic.
   * @param subtopicStat A TopicStats value, representing a particular top level topic.
   * @returns A summary of the given topic.
   */
  async getTopicSummary(topicStat: TopicStats): Promise<string> {
    const sectionTitle: string = `${topicStat.name} (${topicStat.commentCount} comments)`;
    const subtopicSummaries: Array<Promise<string>> =
      topicStat.subtopicStats?.map((subtopicStat) => this.getSubtopicSummary(subtopicStat)) || [];
    const nSubtopics: number = topicStat.subtopicStats?.length || 0;
    const subtopicsSummaryText: string =
      subtopicSummaries.length > 0
        ? await resolvePromisesInParallel(subtopicSummaries).then((summaries) =>
            summaries.join("\n")
          )
        : "";
    // This is just a stub for now, and may eventually be added on to include more naunced descriptions of e.g. where the highest
    // points of common ground and most significant differences of opinion were across the subtopics.
    const topicSummary =
      nSubtopics > 0
        ? `This topic included ${nSubtopics} subtopic${nSubtopics === 1 ? "" : "s"}.`
        : "";

    return Promise.resolve(
      `### ${sectionTitle}

${topicSummary}

${subtopicsSummaryText}
`
    );
  }

  /**
   * Generate a summary for the given subtopic.
   * @param subtopicStat A TopicStats value, representing a particular subtopic.
   * @returns A summary of the given subtopic.
   */
  async getSubtopicSummary(subtopicStat: TopicStats): Promise<string> {
    const sectionTitle: string = `${subtopicStat.name} (${subtopicStat.commentCount} comments)`;

    const groupStats = this.input.getStatsByGroup();
    const groupNames = groupStats.map((stat: GroupStats) => {
      return stat.name;
    });

    const commonGroundSummary = await this.getCommonGroundSummary();
    const differencesSummary = await this.getDifferencesOfOpinionSummary(groupNames);

    return Promise.resolve(
      `#### ${sectionTitle}

Common ground between groups: ${commonGroundSummary}

Differences of opinion: ${differencesSummary}
`
    );
  }

  /**
   * Summarizes the comments on which there was the strongest agreement between groups.
   * @returns a short paragraph describing the similarities between groups, including comment citations.
   */
  async getCommonGroundSummary(): Promise<string> {
    const commonGroundComments = this.input.getCommonGroundComments();
    const summary = this.model.generateText(
      getPrompt(
        commonGroundInstructions,
        commonGroundComments.map((comment: Comment): string => comment.text),
        this.additionalInstructions
      )
    );
    return summary + getCommentCitations(commonGroundComments);
  }

  /**
   * Summarizes the comments on which there was the strongest disagreement between groups.
   * @returns a short paragraph describing the differences between groups, including comment citations.
   */
  async getDifferencesOfOpinionSummary(groupNames: string[]): Promise<string> {
    const topDisagreeCommentsAcrossGroups =
      this.input.getDifferencesBetweenGroupsComments(groupNames);
    const summary = this.model.generateText(
      getPrompt(
        differencesOfOpinionInstructions,
        topDisagreeCommentsAcrossGroups.map((comment: Comment) => comment.text),
        this.additionalInstructions
      )
    );
    return summary + getCommentCitations(topDisagreeCommentsAcrossGroups);
  }
}
