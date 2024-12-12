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

// Utils to get statistical information from a deliberation

import { Comment } from "./types";
import { groupCommentsBySubtopic } from "./sensemaker_utils";

// Statistics to include in the summary.
export class SummaryStats {
  comments: Comment[];
  constructor(comments: Comment[]) {
    this.comments = comments;
  }

  private getCommentVoteCount(comment: Comment): number {
    let count = 0;
    for (const groupName in comment.voteTalliesByGroup) {
      const groupCount = comment.voteTalliesByGroup[groupName].totalCount;
      if (groupCount > 0) {
        count += groupCount;
      }
    }
    return count;
  }

  // The total number of votes in all comments in a deliberation.
  get voteCount(): number {
    return this.comments.reduce((sum: number, comment: Comment) => {
      return sum + this.getCommentVoteCount(comment);
    }, 0);
  }

  // The total number of comments in a deliberation.
  get commentCount(): number {
    return this.comments.length;
  }

  /**
   * Counts the number of comments associated with each topic and subtopic.
   *
   * @param commentsByTopic A nested map where keys are topic names, values are maps
   *                        where keys are subtopic names, and values are maps where
   *                        keys are comment IDs and values are comment texts.
   * @returns An array of `TopicStats` objects.
   */
  getStatsByTopic(): TopicStats[] {
    const commentsByTopic = groupCommentsBySubtopic(this.comments);
    const topicStats: TopicStats[] = [];

    for (const topicName in commentsByTopic) {
      const subtopics = commentsByTopic[topicName];
      const subtopicStats: TopicStats[] = [];
      let totalTopicComments = 0;

      for (const subtopicName in subtopics) {
        const commentCount = Object.keys(subtopics[subtopicName]).length;
        totalTopicComments += commentCount;
        subtopicStats.push({ name: subtopicName, commentCount });
      }

      topicStats.push({
        name: topicName,
        commentCount: totalTopicComments,
        subtopicStats: subtopicStats,
      });
    }

    return topicStats;
  }
}

/**
 * Represents statistics about a topic and its subtopics.
 */
export interface TopicStats {
  name: string;
  commentCount: number;
  subtopicStats?: TopicStats[];
}
