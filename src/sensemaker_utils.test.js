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
const sensemaker_utils_1 = require("./sensemaker_utils");
describe("SensemakerUtilsTest", () => {
    it("should create a prompt", () => {
        expect((0, sensemaker_utils_1.getPrompt)("Summarize this.", ["comment1", "comment2"])).toEqual(`Instructions:
Summarize this.

Comments:
comment1
comment2`);
    });
    it("should include additional instructions in the prompt", () => {
        expect((0, sensemaker_utils_1.getPrompt)("Summarize this.", ["comment1", "comment2"], "This is for a town hall style deliberation")).toEqual(`Instructions:
Summarize this.

Additional context:
This is for a town hall style deliberation

Comments:
comment1
comment2`);
    });
    describe("groupCommentsByTopic", () => {
        it("should group comments by topic and subtopic", () => {
            const categorizedComments = [
                {
                    id: "1",
                    text: "Comment 1",
                    topics: [
                        { name: "Topic 1", subtopics: [{ name: "Subtopic 1.1" }] },
                        { name: "Topic 2", subtopics: [{ name: "Subtopic 2.1" }] },
                    ],
                },
                {
                    id: "2",
                    text: "Comment 2",
                    topics: [
                        { name: "Topic 1", subtopics: [{ name: "Subtopic 1.1" }] },
                        { name: "Topic 1", subtopics: [{ name: "Subtopic 1.2" }] },
                    ],
                },
            ];
            const expectedOutput = {
                "Topic 1": {
                    "Subtopic 1.1": {
                        "1": "Comment 1",
                        "2": "Comment 2",
                    },
                    "Subtopic 1.2": {
                        "2": "Comment 2",
                    },
                },
                "Topic 2": {
                    "Subtopic 2.1": {
                        "1": "Comment 1",
                    },
                },
            };
            const result = (0, sensemaker_utils_1.groupCommentsBySubtopic)(categorizedComments);
            expect(result).toEqual(expectedOutput);
        });
        it("should skip comment if it has no topics", () => {
            const categorizedComments = [
                {
                    id: "1",
                    text: "Comment 1",
                    topics: [], // No topics assigned
                },
            ];
            expect((0, sensemaker_utils_1.groupCommentsBySubtopic)(categorizedComments)).toEqual({});
        });
    });
});
