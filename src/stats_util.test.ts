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

import { SummaryStats } from "./stats_util";
import { Comment } from "./types";

const TEST_COMMENTS = [
  {
    id: "1",
    text: "comment1",
    voteTalliesByGroup: {
      "0": {
        agreeCount: 10,
        disagreeCount: 5,
        passCount: 0,
        totalCount: 15,
      },
      "1": {
        agreeCount: 5,
        disagreeCount: 10,
        passCount: 5,
        totalCount: 20,
      },
    },
  },
  {
    id: "2",
    text: "comment2",
    voteTalliesByGroup: {
      "0": {
        agreeCount: 2,
        disagreeCount: 5,
        passCount: 3,
        totalCount: 10,
      },
      "1": {
        agreeCount: 5,
        disagreeCount: 3,
        passCount: 2,
        totalCount: 10,
      },
    },
  },
];

describe("StatsUtilTest", () => {
  it("should get the total number of votes from multiple comments", () => {
    const summaryStats = new SummaryStats(TEST_COMMENTS);
    expect(summaryStats.voteCount).toEqual(55);
  });

  it("SummaryStats should get the total number of comments", () => {
    const summaryStats = new SummaryStats(TEST_COMMENTS);
    expect(summaryStats.commentCount).toEqual(2);
  });

  it("should count comments by topic", () => {
    const comments: Comment[] = [
      {
        id: "1",
        text: "comment 1",
        topics: [{ name: "Topic A", subtopics: [{ name: "Subtopic A.1" }] }],
      },
      {
        id: "2",
        text: "comment 2",
        topics: [{ name: "Topic A", subtopics: [{ name: "Subtopic A.1" }] }],
      },
      {
        id: "3",
        text: "comment 3",
        topics: [{ name: "Topic A", subtopics: [{ name: "Subtopic A.2" }] }],
      },
    ];

    const expectedTopicStats = [
      {
        name: "Topic A",
        commentCount: 3,
        subtopicStats: [
          { name: "Subtopic A.1", commentCount: 2 },
          { name: "Subtopic A.2", commentCount: 1 },
        ],
      },
    ];
    expect(new SummaryStats(comments).getStatsByTopic()).toEqual(expectedTopicStats);
  });
});
