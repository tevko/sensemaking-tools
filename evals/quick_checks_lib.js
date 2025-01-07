"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPercentageContainsString = getPercentageContainsString;
exports.runQuickChecks = runQuickChecks;
// Library for running quick checks on summarization.
const csv_writer_1 = require("csv-writer");
const QUICK_CHECKS_FILE_NAME = "quickChecks.csv";
function containsString(summary, str) {
    return summary.includes(str);
}
/**
 * Calculates the percentage of summaries that contain an intro section.
 * @param summaries the list of summaries to consider
 * @param str the substring to look for in the summary
 * @returns the percentage of summaries that contain an intro section.
 */
function getPercentageContainsString(summaries, str) {
    const containsIntroCount = summaries.reduce((accumulator, summary) => {
        return accumulator + Number(containsString(summary.getText("MARKDOWN"), str));
    }, 0);
    return (containsIntroCount / summaries.length) * 100;
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
function runQuickChecks(outputDir, summaries) {
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: outputDir + "/" + QUICK_CHECKS_FILE_NAME,
        header: ["evalName", "performance"],
    });
    const outputTexts = [
        {
            evalName: "% of Summaries that Contain an Intro Section",
            performance: getPercentageContainsString(summaries, "Intro"),
        },
        {
            evalName: "% of Summaries that Contain a Conclusion Section",
            performance: getPercentageContainsString(summaries, "Conclusion"),
        },
    ];
    csvWriter
        .writeRecords(outputTexts)
        .then(() => console.log(`${QUICK_CHECKS_FILE_NAME} file written successfully.`));
}
