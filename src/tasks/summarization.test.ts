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
import { SummaryStats } from "../stats_util";
import {
  formatCommentsWithVotes,
  getSummarizationInstructions,
  _sortTopicsByComments,
  _quantifyTopicNames,
  _getIntroText,
} from "./summarization";

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

describe("SummaryTest", () => {
  it("prompt should include the comment count and the vote count", () => {
    // Has 2 comments and 55 votes.
    expect(getSummarizationInstructions(true, new SummaryStats(TEST_COMMENTS))).toContain(
      "2 comments"
    );
    expect(getSummarizationInstructions(true, new SummaryStats(TEST_COMMENTS))).toContain(
      "55 votes"
    );
  });

  it("prompt shouldn't include votes if groups aren't included", () => {
    const testCommentsWithoutVotes = [
      {
        id: "1",
        text: "comment1",
      },
      {
        id: "2",
        text: "comment2",
      },
    ];
    // Has 2 comments and 55 votes.
    expect(
      getSummarizationInstructions(false, new SummaryStats(testCommentsWithoutVotes))
    ).toContain("2 comments");
    expect(
      getSummarizationInstructions(false, new SummaryStats(testCommentsWithoutVotes))
    ).not.toContain("55 votes");
  });

  it("should format comments with vote tallies via formatCommentsWithVotes", () => {
    expect(formatCommentsWithVotes(TEST_COMMENTS)).toEqual([
      `comment1
      vote info per group: {"0":{"agreeCount":10,"disagreeCount":5,"passCount":0,"totalCount":15},"1":{"agreeCount":5,"disagreeCount":10,"passCount":5,"totalCount":20}}`,
      `comment2
      vote info per group: {"0":{"agreeCount":2,"disagreeCount":5,"passCount":3,"totalCount":10},"1":{"agreeCount":5,"disagreeCount":3,"passCount":2,"totalCount":10}}`,
    ]);
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

  it("should create an intro section", () => {
    expect(
      _getIntroText(100, 321, {
        "Topic A (5 comments)": ["Subtopic A.1 (2 comments)", "Subtopic A.2 (3 comments)"],
        "Topic B (3 comments)": ["Subtopic B.1 (2 comments)", "Subtopic B.2 (1 comments)"],
      })
    )
      .toEqual(`This report summarizes the results of public input, encompassing __100 comments__ and __321 votes__. All voters were anonymous. The public input collected covered a wide range of topics and subtopics, including:
 * __Topic A (5 comments)__
     * Subtopic A.1 (2), Subtopic A.2 (3)
 * __Topic B (3 comments)__
     * Subtopic B.1 (2), Subtopic B.2 (1)
`);
  });
});
