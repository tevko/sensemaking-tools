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
import {
  formatCommentsWithVotes,
  _countCommentsByTopic,
  _sortTopicsByComments,
  _quantifyTopicNames,
} from "./summarization";

describe("SummaryTest", () => {
  it("should format comments with vote tallies via formatCommentsWithVotes", () => {
    expect(
      formatCommentsWithVotes([
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
      ])
    ).toEqual([
      `comment1
      vote info per group: {"0":{"agreeCount":10,"disagreeCount":5,"passCount":0,"totalCount":15},"1":{"agreeCount":5,"disagreeCount":10,"passCount":5,"totalCount":20}}`,
      `comment2
      vote info per group: {"0":{"agreeCount":2,"disagreeCount":5,"passCount":3,"totalCount":10},"1":{"agreeCount":5,"disagreeCount":3,"passCount":2,"totalCount":10}}`,
    ]);
  });

  it("should count comments by topic", () => {
    const commentsByTopic = {
      "Topic A": {
        "Subtopic A.1": { c1: "comment 1", c2: "comment 2" },
        "Subtopic A.2": { c3: "comment 3" },
      },
    };

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
    expect(_countCommentsByTopic(commentsByTopic)).toEqual(expectedTopicStats);
  });

  it("should sort topics by comment count and put 'Other' topics and subtopics last", () => {
    const topicStats = [
      {
        name: "Topic A",
        commentCount: 3,
        subtopicStats: [
          { name: "Subtopic A.1", commentCount: 2 },
          { name: "Subtopic A.2", commentCount: 1 },
        ],
      },
      {
        name: "Other",
        commentCount: 5,
        subtopicStats: [
          { name: "Subtopic Other.1", commentCount: 2 },
          { name: "Other", commentCount: 3 },
        ],
      },
      {
        name: "Topic B",
        commentCount: 6,
        subtopicStats: [
          { name: "Subtopic B.1", commentCount: 4 },
          { name: "Subtopic B.2", commentCount: 2 },
        ],
      },
    ];

    const expectedSortedTopics = [
      {
        name: "Topic B",
        commentCount: 6,
        subtopicStats: [
          { name: "Subtopic B.1", commentCount: 4 },
          { name: "Subtopic B.2", commentCount: 2 },
        ],
      },
      {
        name: "Topic A",
        commentCount: 3,
        subtopicStats: [
          { name: "Subtopic A.1", commentCount: 2 },
          { name: "Subtopic A.2", commentCount: 1 },
        ],
      },
      {
        name: "Other",
        commentCount: 5,
        subtopicStats: [
          { name: "Subtopic Other.1", commentCount: 2 },
          { name: "Other", commentCount: 3 },
        ],
      },
    ];
    expect(_sortTopicsByComments(topicStats)).toEqual(expectedSortedTopics);
  });

  it("should quantify topic names", () => {
    const topicStats = [
      {
        name: "Topic A",
        commentCount: 5,
        subtopicStats: [
          { name: "Subtopic A.1", commentCount: 2 },
          { name: "Subtopic A.2", commentCount: 3 },
        ],
      },
    ];

    const expectedQuantified = {
      "Topic A (5 comments)": ["Subtopic A.1 (2 comments)", "Subtopic A.2 (3 comments)"],
    };

    expect(_quantifyTopicNames(topicStats)).toEqual(expectedQuantified);
  });
});
