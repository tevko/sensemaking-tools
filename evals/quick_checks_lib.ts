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

// Library for running quick checks on summarization.

import { createObjectCsvWriter } from "csv-writer";
import { Summary, Topic } from "../src/types";

const QUICK_CHECKS_FILE_NAME = "quickChecks.csv";

function containsString(summary: string, str: string): boolean {
  return summary.includes(str);
}

/**
 * Calculates the percentage of summaries that contain an intro section.
 * @param summaries the list of summaries to consider
 * @param str the substring to look for in the summary
 * @returns the percentage of summaries that contain an intro section.
 */
export function getPercentageContainsString(summaries: Summary[], str: string): number {
  const containsIntroCount = summaries.reduce((accumulator, summary: Summary) => {
    return accumulator + Number(containsString(summary.getText("MARKDOWN"), str));
  }, 0);
  return (containsIntroCount / summaries.length) * 100;
}

/**
 * Get a list of subtopic names from a Topic object.
 * @param topics the topics to flatten.
 */
export function getSubtopicNames(topics: Topic[]): string[] {
  const nestedSubtopics: Topic[][] = topics.map((topic: Topic) => {
    return "subtopics" in topic ? topic.subtopics : [];
  });
  const subtopics: Topic[] = nestedSubtopics.reduce(
    (accumulator, value: Topic[]) => accumulator.concat(value),
    []
  );
  return subtopics.map((topic: Topic): string => {
    return topic.name;
  });
}

export function getPercentageContainsStrings(
  summaries: Summary[],
  expectedMatches: string[]
): number {
  let matchCount = 0;
  for (const summary of summaries) {
    for (const expectedMatch of expectedMatches) {
      matchCount += Number(containsString(summary.getText("MARKDOWN"), expectedMatch));
    }
  }
  return (matchCount / expectedMatches.length / summaries.length) * 100;
}
/**
 * Run a series of simple automated tests.
 *
 * This should be used as a binary check for summarization, and it should pass all tests. Failing
 * a test means there is an issue with the summary but passing all tests doesn't necessarily mean
 * the test is good. The checks include: that there's an intro section and that there's a
 * conclusion section.
 *
 * @param outputDir the directory to output the eval results to.
 * @param summaries the summaries to consider.
 */
export function runQuickChecks(outputDir: string, summaries: Summary[], topics: Topic[]) {
  const csvWriter = createObjectCsvWriter({
    path: outputDir + "/" + QUICK_CHECKS_FILE_NAME,
    header: ["evalName", "performance"],
  });
  const outputTexts = [
    {
      evalName: "% of Summaries that Contain an Intro Section (expect 100%)",
      performance: getPercentageContainsString(summaries, "Intro"),
    },
    {
      evalName: "% of Summaries that Contain a Conclusion Section (expect 100%)",
      performance: getPercentageContainsString(summaries, "Conclusion"),
    },
    {
      evalName: "% of Topics Included in Summary (expect 100%)",
      performance: getPercentageContainsStrings(
        summaries,
        topics.map((topic: Topic): string => {
          return topic.name;
        })
      ),
    },
    {
      evalName: "% of Subtopics Included in Summary (expect 100%)",
      performance: getPercentageContainsStrings(summaries, getSubtopicNames(topics)),
    },
  ];

  csvWriter
    .writeRecords(outputTexts)
    .then(() => console.log(`${QUICK_CHECKS_FILE_NAME} file written successfully.`));
}
