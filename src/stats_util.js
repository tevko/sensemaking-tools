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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummaryStats = void 0;
const sensemaker_utils_1 = require("./sensemaker_utils");
// Statistics to include in the summary.
class SummaryStats {
    constructor(comments) {
        this.comments = comments;
    }
    getCommentVoteCount(comment) {
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
    get voteCount() {
        return this.comments.reduce((sum, comment) => {
            return sum + this.getCommentVoteCount(comment);
        }, 0);
    }
    // The total number of comments in a deliberation.
    get commentCount() {
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
    getStatsByTopic() {
        const commentsByTopic = (0, sensemaker_utils_1.groupCommentsBySubtopic)(this.comments);
        const topicStats = [];
        for (const topicName in commentsByTopic) {
            const subtopics = commentsByTopic[topicName];
            const subtopicStats = [];
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
exports.SummaryStats = SummaryStats;
