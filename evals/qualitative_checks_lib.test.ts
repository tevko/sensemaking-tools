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

import { getAverageStringCount, sumMapValues } from "./qualitative_checks_lib";

describe("QualitativeChecksTest", () => {
  it("Should getAverageStringCount.", () => {
    expect(getAverageStringCount("cat", ["Cats are the best", "I have a cat named Cat"])).toEqual(
      1.5
    );
  });

  it("Should sumMapValues for a map with number values", () => {
    expect(
      sumMapValues(
        new Map([
          ["a", 1],
          ["b", 2],
          ["c", 3],
        ])
      )
    ).toEqual(6);
  });
});
