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
const types_1 = require("../types");
const stats_util_1 = require("../stats_util");
const stats_checker_1 = require("./stats_checker");
// Has 5 comments and 60 votes.
const TEST_SUMMARY_STATS = new stats_util_1.SummaryStats([
    { id: "1", text: "hello", voteTalliesByGroup: { "group 0": new types_1.VoteTally(10, 20, 30) } },
    { id: "2", text: "hello" },
    { id: "3", text: "hello" },
    { id: "4", text: "hello" },
    { id: "5", text: "hello" },
]);
describe("StatsCheckerTest", () => {
    it("should return true for a good summary", () => {
        const summary = "There are 60 votes and 5 comments.";
        expect((0, stats_checker_1.summaryContainsStats)(summary, TEST_SUMMARY_STATS, types_1.SummarizationType.VOTE_TALLY)).toBeTruthy();
    });
    it("should return false if missing the right comment count", () => {
        const summary = "There are 60 votes and 6 comments.";
        expect((0, stats_checker_1.summaryContainsStats)(summary, TEST_SUMMARY_STATS, types_1.SummarizationType.VOTE_TALLY)).toBeFalsy();
    });
    it("should return false if missing the right vote count", () => {
        const summary = "There are 6 votes and 5 comments.";
        expect((0, stats_checker_1.summaryContainsStats)(summary, TEST_SUMMARY_STATS, types_1.SummarizationType.VOTE_TALLY)).toBeFalsy();
    });
});
