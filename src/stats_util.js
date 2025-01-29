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
exports.GroupedSummaryStats = exports.SummaryStats = void 0;
exports.getAgreeProbability = getAgreeProbability;
exports.getGroupInformedConsensus = getGroupInformedConsensus;
exports.getMinAgreeProb = getMinAgreeProb;
exports.getGroupAgreeProbDifference = getGroupAgreeProbDifference;
exports.getCommentVoteCount = getCommentVoteCount;
// Utils to get statistical information from a conversation
const types_1 = require("./types");
const sensemaker_utils_1 = require("./sensemaker_utils");
/**
 * A function which returns the estimated aggree probability for a given vote tally entry as a MAP estimate
 */
function getAgreeProbability(voteTally) {
    const totalCount = voteTally.agreeCount + voteTally.disagreeCount + (voteTally.passCount || 0);
    // We add +1 and +2 to the numerator and demonenator respectively as a psuedo-count prior so that probabilities tend to 1/2 in the
    // absence of data, and to avoid division/multiplication by zero in group informed consensus and risk ratio calculations. This is technically
    // a simple maxima a priori (MAP) probability estimate.
    return (voteTally.agreeCount + 1) / (totalCount + 2);
}
/**
 * A function which computes group informed consensus for the given set of vote tallies, given vote tally data, aggregated by some groupBy factor.
 * Computed as the product of the aggree probabilities
 */
function getGroupInformedConsensus(comment) {
    return Object.values(comment.voteTalliesByGroup).reduce((product, voteTally) => product * getAgreeProbability(voteTally), 1);
}
/**
 * A function which returns the minimum aggree probability across groups
 */
function getMinAgreeProb(comment) {
    return Math.min(...Object.values(comment.voteTalliesByGroup).map(getAgreeProbability));
}
/**
 * Computes the difference between the MAP agree probabilities for a given group, as computed by the getAgreeProbability function, as compared
 * with the rest of the conversation
 */
function getGroupAgreeProbDifference(comment, group) {
    const groupAgreeProb = getAgreeProbability(comment.voteTalliesByGroup[group]);
    // compute the vote tally for the remainder of the conversation by reducing over and adding up all other group vote tallies
    const otherGroupsVoteTally = Object.entries(comment.voteTalliesByGroup)
        .filter(([g]) => g !== group)
        // build up the new VoteTally object as a reduction of the vote counts for the remaining groups
        .map(([_, voteTally]) => voteTally) // eslint-disable-line @typescript-eslint/no-unused-vars
        .reduce((acc, voteTally) => {
        return {
            agreeCount: acc.agreeCount + voteTally.agreeCount,
            disagreeCount: acc.disagreeCount + voteTally.disagreeCount,
            passCount: (acc.passCount || 0) + (voteTally.passCount || 0),
            totalCount: acc.totalCount + voteTally.totalCount,
        };
    }, { agreeCount: 0, disagreeCount: 0, passCount: 0, totalCount: 0 });
    const otherGroupsAgreeProb = getAgreeProbability(otherGroupsVoteTally);
    return groupAgreeProb - otherGroupsAgreeProb;
}
function getCommentVoteCount(comment) {
    let count = 0;
    for (const groupName in comment.voteTalliesByGroup) {
        const groupCount = comment.voteTalliesByGroup[groupName].totalCount;
        if (groupCount > 0) {
            count += groupCount;
        }
    }
    return count;
}
// Statistics to include in the summary.
class SummaryStats {
    constructor(comments) {
        this.minAgreeProbCommonGround = 0.6;
        this.minAgreeProbDifference = 0.3;
        this.maxSampleSize = 5;
        this.comments = comments;
    }
    // The total number of votes across the entire set of input comments
    get voteCount() {
        return this.comments.reduce((sum, comment) => {
            return sum + getCommentVoteCount(comment);
        }, 0);
    }
    // The total number of comments in the set of input comments
    get commentCount() {
        return this.comments.length;
    }
    get containsSubtopics() {
        for (const comment of this.comments) {
            if (comment.topics) {
                for (const topic of comment.topics) {
                    // Check if the topic matches the 'NestedTopic' type
                    if ("subtopics" in topic && Array.isArray(topic.subtopics)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * Returns the top k comments according to the given metric. K defaults to 12.
     */
    topK(sortBy, k = this.maxSampleSize, filterFn = () => true) {
        return this.comments
            .filter(filterFn)
            .sort((a, b) => sortBy(b) - sortBy(a))
            .slice(0, k);
    }
    /**
     * Sorts topics and their subtopics based on comment count in descending order, with
     * "Other" topics and subtopics going last.
     *
     * @param commentsByTopic A nested map where keys are topic names, values are maps
     *                        where keys are subtopic names, and values are maps where
     *                        keys are comment IDs and values are comment texts.
     * @returns A list of TopicStats objects sorted by comment count with "Other" topics last.
     */
    getStatsByTopic() {
        const commentsByTopic = (0, sensemaker_utils_1.groupCommentsBySubtopic)(this.comments);
        const topicStats = [];
        for (const topicName in commentsByTopic) {
            const subtopics = commentsByTopic[topicName];
            const subtopicStats = [];
            let totalTopicComments = 0;
            const topicComments = [];
            for (const subtopicName in subtopics) {
                // get corresonding comments, and update counts
                const comments = Object.values(subtopics[subtopicName]);
                const commentCount = comments.length;
                totalTopicComments += commentCount;
                // aggregate comment objects
                topicComments.push(...comments);
                subtopicStats.push({ name: subtopicName, commentCount, comments: comments });
            }
            topicStats.push({
                name: topicName,
                commentCount: totalTopicComments,
                comments: topicComments,
                subtopicStats: subtopicStats,
            });
        }
        topicStats.sort((a, b) => {
            if (a.name === "Other")
                return 1;
            if (b.name === "Other")
                return -1;
            return b.commentCount - a.commentCount;
        });
        topicStats.forEach((topic) => {
            if (topic.subtopicStats) {
                topic.subtopicStats.sort((a, b) => {
                    if (a.name === "Other")
                        return 1;
                    if (b.name === "Other")
                        return -1;
                    return b.commentCount - a.commentCount;
                });
            }
        });
        return topicStats;
    }
}
exports.SummaryStats = SummaryStats;
class GroupedSummaryStats extends SummaryStats {
    constructor(comments) {
        super(comments);
        this.minVoteCount = 20;
        this.filteredComments = comments.filter(types_1.isCommentWithVoteTalliesType).filter((comment) => {
            return getCommentVoteCount(comment) >= this.minVoteCount;
        });
    }
    /**
     * Returns the top k comments according to the given metric. K defaults to 12.
     */
    topK(sortBy, k = this.maxSampleSize, filterFn = () => true) {
        return this.filteredComments
            .filter(filterFn)
            .sort((a, b) => sortBy(b) - sortBy(a))
            .slice(0, k);
    }
    /**
     * Gets the topK agreed upon comments across all groups.
     *
     * This is measured via the getGroupInformedConsensus metric, subject to the constraints of
     * this.minVoteCount and this.minAgreeProbCommonGround settings.
     * @param k dfaults to this.maxSampleSize
     * @returns the top agreed on comments
     */
    getCommonGroundComments(k = this.maxSampleSize) {
        return this.topK((comment) => getGroupInformedConsensus(comment), k, 
        // Before using Group Informed Consensus a minimum bar of agreement between groups is enforced
        (comment) => getMinAgreeProb(comment) >= this.minAgreeProbCommonGround);
    }
    /**
     * Sort through the comments with the highest getGroupAgreeDifference for the corresponding group,
     * subject to this.minVoteCount, not matching the common ground comment set by this.minAgreeProbCommonGround,
     * and this.minAgreeProbDifference
     * @param group The name of a single group
     * @param k dfaults to this.maxSampleSize
     * @returns The corresponding set of comments
     */
    getGroupRepresentativeComments(group, k = this.maxSampleSize) {
        return this.topK((comment) => getGroupAgreeProbDifference(comment, group), k, (comment) => getMinAgreeProb(comment) < this.minAgreeProbCommonGround &&
            getGroupAgreeProbDifference(comment, group) > this.minAgreeProbDifference);
    }
    /**
     * Returns the top K comments that best distinguish differences of opinion between groups.
     *
     * This is computed as the difference in how likely each group is to agree with a given comment
     * as compared with the rest of the participant body, as computed by the getGroupAgreeDifference method,
     * and subject to this.minVoteCount, this.minAgreeProbCommonGround and this.minAgreeProbDifference.
     *
     * @param groups The name of a single group
     * @param k defaults to this.maxSampleSize
     * @returns the top disagreed on comments
     */
    getDifferencesBetweenGroupsComments(groupNames, k = this.maxSampleSize) {
        return this.topK(
        // Get the maximum absolute group agree difference for any group.
        (comment) => Math.max(...groupNames.map((name) => {
            return Math.abs(getGroupAgreeProbDifference(comment, name));
        })), k, (comment) => {
            // Each the groups must disagree with the rest of the groups above an absolute
            // threshold before we consider taking the topK.
            for (const groupName of groupNames) {
                if (Math.abs(getGroupAgreeProbDifference(comment, groupName)) < this.minAgreeProbDifference) {
                    return false;
                }
            }
            return true;
        });
    }
    getStatsByGroup() {
        const groupNameToStats = {};
        for (const comment of this.comments) {
            for (const groupName in comment.voteTalliesByGroup) {
                const commentVoteCount = comment.voteTalliesByGroup[groupName].totalCount;
                if (groupName in groupNameToStats) {
                    groupNameToStats[groupName].voteCount += commentVoteCount;
                }
                else {
                    groupNameToStats[groupName] = { name: groupName, voteCount: commentVoteCount };
                }
            }
        }
        return Object.values(groupNameToStats);
    }
}
exports.GroupedSummaryStats = GroupedSummaryStats;
