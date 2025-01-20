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
import { TopicStats, GroupedSummaryStats } from "../../stats_util";

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

    // For now, these are mocked out...
    const commonGroundSummary = "Some points of common ground...";
    const differencesSummary = "Areas of disagreement between groups...";

    return Promise.resolve(
      `#### ${sectionTitle}

Common ground: ${commonGroundSummary}

Differences of opinion: ${differencesSummary}
`
    );
  }
}
