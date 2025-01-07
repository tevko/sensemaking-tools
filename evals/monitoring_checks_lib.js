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
exports.runMonitoringChecks = runMonitoringChecks;
// Library for monitoring how the library is running.
const csv_writer_1 = require("csv-writer");
const MONITORING_CHECKS_FILE_NAME = "monitoringChecks.csv";
/**
 * Monitor how summarization is running.
 *
 * This should be used to check how the summarization is running.
 * The checks include: the failure rate of summarization, how long summarization took
 * @param outputDir where to output the eval results
 * @param rerunCount
 * @param failureCount
 * @param runTimes
 */
function runMonitoringChecks(outputDir, rerunCount, failureCount, runTimes) {
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: outputDir + "/" + MONITORING_CHECKS_FILE_NAME,
        header: ["evalName", "performance"],
    });
    const output = [
        {
            evalName: "Rate of failure for summarization",
            performance: failureCount / rerunCount,
        },
        {
            evalName: "Average time to run summarization (minutes)",
            performance: runTimes.reduce((a, b) => a + b) / runTimes.length / (1000 * 60),
        },
    ];
    csvWriter
        .writeRecords(output)
        .then(() => console.log(`${MONITORING_CHECKS_FILE_NAME} file written successfully.`));
}
