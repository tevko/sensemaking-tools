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

// Library for qualitative evals of how the library is running.

import { createObjectCsvWriter } from "csv-writer";

const QUALITATIVE_CHECKS_FILE_NAME = "qualitativeChecks.csv";

/**
 * Get the average number of times searchStr is present in a summary. Not case sensitive.
 * @param searchStr the substring to search for
 * @param summaries the text to consider
 * @returns the average number of times searchStr is present in a summary.
 */
export function getAverageStringCount(searchStr: string, summaries: string[]): number {
  let totalOccurrences = 0;

  for (const summary of summaries) {
    const summaryText = summary.toLowerCase();
    let occurrences = 0;
    let startIndex = 0;
    while (startIndex !== -1) {
      startIndex = summaryText.indexOf(searchStr.toLowerCase(), startIndex);
      if (startIndex !== -1) {
        occurrences++;
        startIndex += searchStr.length;
      }
    }
    totalOccurrences += occurrences;
  }

  return totalOccurrences / summaries.length;
}

/**
 * Gets the sum of values in a map.
 * @param map the map with number values to sum
 * @returns the sum of all the values.
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function sumMapValues(map: Map<any, number>): number {
  const values = Array.from(map.values());
  return values.reduce((acc, val) => acc + val, 0);
}

/**
 * Run qualitative checks on the summary output.
 *
 * This checks that each of the groups get an "equal" amount of discussion by counting how many
 * times each is mentioned. This is a qualitative eval and there's no correct ratio, but it would
 * be reasonable to expect that the groups are mentioned between these two extremes: all groups are
 * mentioned the same number of times, known as Fixed Representation (expect 1/numberOfGroups) or
 * each group is mentioned in proportion to how many people it contains, known as Proportional
 * Representation (expect numberOfPeopleInGroup/numberOfPeople). This metric doesn't account for
 * indirect mentions of groups (ie. "the previous group", "they", etc).
 *
 * @param outputDir the directory to output the qualitative checks.
 * @param summaries the summaries to consider
 * @param groupNameToSize the name of each group to the number of particpants
 */
export function runQualitativeChecks(
  outputDir: string,
  summaries: string[],
  groupNameToSize: Map<string, number>
) {
  const csvWriter = createObjectCsvWriter({
    path: outputDir + "/" + QUALITATIVE_CHECKS_FILE_NAME,
    header: [
      { id: "evalName", title: "Evaluation Name" },
      { id: "performance", title: "Performance" },
      {
        id: "proportionalRepresentation",
        title: "Expected Proportional Representation",
      },
      {
        id: "fixedRepresentation",
        title: "Expected Fixed Representation",
      },
    ],
  });
  let output: {
    evalName: string;
    performance: number;
    proportionalRepresentation: string;
    fixedRepresentation: string;
  }[] = [];

  const groupNameToMentionsCount: Map<string, number> = new Map();
  for (const groupName of groupNameToSize.keys()) {
    groupNameToMentionsCount.set(groupName, getAverageStringCount(groupName, summaries));
  }

  const totalNameMentions = sumMapValues(groupNameToMentionsCount);
  const totalParticipantCount = sumMapValues(groupNameToSize);
  for (const groupName of groupNameToSize.keys()) {
    const proportionOfParticipantsInGroup = groupNameToSize.get(groupName)! / totalParticipantCount;
    output = output.concat([
      {
        evalName: `Number of times "${groupName}" is in Summary`,
        performance: groupNameToMentionsCount.get(groupName) || 0,
        proportionalRepresentation: (proportionOfParticipantsInGroup * totalNameMentions).toFixed(
          2
        ),
        fixedRepresentation: ((1 / groupNameToSize.size) * totalNameMentions).toFixed(2),
      },
      {
        evalName: `% of of times "${groupName}" in Summary Compared to Other Named Groups`,
        performance: (groupNameToMentionsCount.get(groupName) || 0) / totalNameMentions,
        proportionalRepresentation: proportionOfParticipantsInGroup.toFixed(2),
        fixedRepresentation: (1 / groupNameToSize.size).toFixed(2),
      },
    ]);
  }

  csvWriter
    .writeRecords(output)
    .then(() => console.log(`${QUALITATIVE_CHECKS_FILE_NAME} file written successfully.`));
}
