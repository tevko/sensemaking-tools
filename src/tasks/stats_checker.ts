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

// Checks a Summary for simple string matches.

import { SummarizationType } from "../types";
import { SummaryStats } from "../stats_util";

/**
 * Checks that a summary contains the numbers from the SummaryStats.
 * @param summary the summary to consider
 * @param summaryStats the numbers to check that the summary contains
 * @param summarizationType the type of summarization done
 * @returns true if the summary contains the statistics (not necessarily in the right context)
 */
export function summaryContainsStats(
  summary: string,
  summaryStats: SummaryStats,
  summarizationType: SummarizationType
): boolean {
  const commentCount = summaryStats.commentCount.toLocaleString();
  if (!summary.includes(`${commentCount} comments`)) {
    console.error(`Summary does not contain the correct number of total comments from the
        deliberation. commentCount=${commentCount} and summary=${summary}`);
    return false;
  }

  const voteCount = summaryStats.voteCount.toLocaleString();
  if (
    summarizationType == SummarizationType.VOTE_TALLY &&
    !summary.includes(`${voteCount} votes`)
  ) {
    console.error(`Summary does not contain the correct number of total votes from the
        deliberation. voteCount=${voteCount} and summary=${summary}`);
    return false;
  }

  return true;
}
