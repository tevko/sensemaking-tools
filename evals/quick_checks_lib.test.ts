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
  getPercentageContainsString,
  getPercentageContainsStrings,
  getSubtopicNames,
} from "./quick_checks_lib";

describe("QuickChecksTest", () => {
  it("Should correctly calculate the % of intros with a summary.", () => {
    const summaryWithIntro = "This is the Intro for a summary. The summary is about a city";
    const summaryWithoutIntro = "The summary is about a city. The city is big";

    expect(getPercentageContainsString([summaryWithIntro, summaryWithoutIntro], "Intro")).toEqual(
      50
    );
  });

  it("Should get list of Subtopic names from Topics array.", () => {
    const topics = [
      { name: "Topic 1", subtopics: [{ name: "Subtopic 1" }, { name: "Subtopic 2" }] },
      { name: "Topic 2" },
      { name: "Topic 3", subtopics: [{ name: "Subtopic 3" }] },
    ];
    expect(getSubtopicNames(topics)).toEqual(["Subtopic 1", "Subtopic 2", "Subtopic 3"]);
  });

  it("Should calculate the perecentage of topics in a summary.", () => {
    const summaryWithAllTopics =
      "Topic 3: This is the Intro for a summary. Topic 1 Topic 2: The summary is about a city ";
    const summaryWithOneTopic = "The summary is about a Topic 2 The city is big";

    // The first summary has all topics (3/3) and the second summary has one topic (1/3). This
    // should average out to 2/3 of topics are included.
    expect(
      getPercentageContainsStrings(
        [summaryWithAllTopics, summaryWithOneTopic],
        ["Topic 1", "Topic 2", "Topic 3"]
      )
    ).toEqual((2 / 3) * 100);
  });
});
