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

import { Summary } from "../src/types";
import { getPercentageContainsString } from "./quick_checks_lib";

describe("QuickChecksTest", () => {
  it("Should correctly calculate the % of intros with a summary.", () => {
    const summaryWithIntro = new Summary(
      [{ text: "This is the Intro for a summary" }, { text: "The summary is about a city" }],
      []
    );
    const summaryWithoutIntro = new Summary(
      [{ text: "The summary is about a city" }, { text: "The city is big" }],
      []
    );

    expect(getPercentageContainsString([summaryWithIntro, summaryWithoutIntro], "Intro")).toEqual(
      50
    );
  });
});
