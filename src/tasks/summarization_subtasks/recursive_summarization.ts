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

// Functions for different ways to summarize Comment and Vote data.

import { Model } from "../../models/model";
import { SummaryStats } from "../../stats_util";

export abstract class RecursiveSummary {
  private input: SummaryStats;
  private model: Model;

  constructor(input: SummaryStats, model: Model) {
    this.input = input;
    this.model = model;
  }

  abstract getSummary(): Promise<string>;
}
