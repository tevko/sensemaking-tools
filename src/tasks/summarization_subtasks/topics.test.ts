// Copyright 2025 Google LLC
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

import { VertexModel } from "../../models/vertex_model";
import { GroupedSummaryStats } from "../../stats_util";
import { CommentWithVoteTallies } from "../../types";
import { TopicsSummary } from "./topics";

const TEST_COMMENTS: CommentWithVoteTallies[] = [
  {
    id: "1",
    text: "comment 1",
    voteTalliesByGroup: {
      "0": { agreeCount: 10, disagreeCount: 5, passCount: 0, totalCount: 15 },
      "1": { agreeCount: 5, disagreeCount: 10, passCount: 5, totalCount: 20 },
    },
    topics: [{ name: "Topic A", subtopics: [{ name: "Subtopic A.1" }] }],
  },
  {
    id: "2",
    text: "comment 2",
    voteTalliesByGroup: {
      "0": { agreeCount: 10, disagreeCount: 5, passCount: 0, totalCount: 15 },
      "1": { agreeCount: 5, disagreeCount: 10, passCount: 5, totalCount: 20 },
    },
    topics: [{ name: "Topic A", subtopics: [{ name: "Subtopic A.1" }] }],
  },
  {
    id: "3",
    text: "comment 3",
    voteTalliesByGroup: {
      "0": { agreeCount: 10, disagreeCount: 5, passCount: 0, totalCount: 15 },
      "1": { agreeCount: 5, disagreeCount: 10, passCount: 5, totalCount: 20 },
    },
    topics: [{ name: "Topic A", subtopics: [{ name: "Subtopic A.2" }] }],
  },
  {
    id: "4",
    text: "comment 4",
    voteTalliesByGroup: {
      "0": { agreeCount: 10, disagreeCount: 5, passCount: 0, totalCount: 15 },
      "1": { agreeCount: 5, disagreeCount: 10, passCount: 5, totalCount: 20 },
    },
    topics: [{ name: "Topic B", subtopics: [{ name: "Subtopic B.1" }] }],
  },
];

describe("TopicsSummaryTest", () => {
  it("should create a properly formatted topics summary", async () => {
    expect(
      await new TopicsSummary(
        new GroupedSummaryStats(TEST_COMMENTS),
        new VertexModel("project123", "usa")
      ).getSummary()
    ).toEqual(`## Topics

From the comments submitted, 2 high level topics were identified, as well as 3 subtopics. Based on voting patterns between the opinion groups described above, both points of common ground as well as differences of opinion between the groups have been identified and are described below.

### Topic A (3 comments)

This topic included 2 subtopics.

#### Subtopic A.1 (2 comments)

Common ground: Some points of common ground...

Differences of opinion: Areas of disagreement between groups...

#### Subtopic A.2 (1 comments)

Common ground: Some points of common ground...

Differences of opinion: Areas of disagreement between groups...


### Topic B (1 comments)

This topic included 1 subtopic.

#### Subtopic B.1 (1 comments)

Common ground: Some points of common ground...

Differences of opinion: Areas of disagreement between groups...


`);
  });
});
