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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sensemaker_1 = require("./sensemaker");
const vertex_model_1 = require("./models/vertex_model");
const TEST_MODEL_SETTINGS = {
    defaultModel: new vertex_model_1.VertexModel("project", "location", "Gemma1234"),
};
// Mock the model response. This mock needs to be set up to return response specific for each test.
let mockGenerateData;
describe("SensemakerTest", () => {
    beforeEach(() => {
        mockGenerateData = jest.spyOn(vertex_model_1.VertexModel.prototype, "generateData");
    });
    afterEach(() => {
        mockGenerateData.mockRestore();
    });
    describe("CategorizeTest", () => {
        it("should batch comments correctly", () => __awaiter(void 0, void 0, void 0, function* () {
            const comments = [
                { id: "1", text: "Comment 1" },
                { id: "2", text: "Comment 2" },
            ];
            const topics = [{ name: "Topic 1" }];
            const includeSubtopics = false;
            mockGenerateData
                .mockReturnValueOnce(Promise.resolve([
                {
                    id: "1",
                    topics: [{ name: "Topic 1" }],
                },
            ]))
                .mockReturnValueOnce(Promise.resolve([
                {
                    id: "2",
                    topics: [{ name: "Topic 1" }],
                },
            ]));
            const actualComments = yield new sensemaker_1.Sensemaker(TEST_MODEL_SETTINGS).categorizeComments(comments, includeSubtopics, topics, undefined);
            expect(mockGenerateData).toHaveBeenCalledTimes(2);
            // Assert that the categorized comments are correct
            const expected = [
                {
                    id: "1",
                    text: "Comment 1",
                    topics: [{ name: "Topic 1" }],
                },
                {
                    id: "2",
                    text: "Comment 2",
                    topics: [{ name: "Topic 1" }],
                },
            ];
            expect(actualComments).toEqual(expected);
        }));
    });
    describe("TopicModelingTest", () => {
        it("should retry topic modeling when the subtopic is the same as a main topic", () => __awaiter(void 0, void 0, void 0, function* () {
            const comments = [
                { id: "1", text: "Comment about Roads" },
                { id: "2", text: "Comment about Parks" },
                { id: "3", text: "Another comment about Roads" },
            ];
            const includeSubtopics = true;
            const topics = [{ name: "Infrastructure" }, { name: "Environment" }];
            const validResponse = [
                {
                    name: "Infrastructure",
                    subtopics: [{ name: "Roads" }],
                },
                {
                    name: "Environment",
                    subtopics: [{ name: "Parks" }],
                },
            ];
            // Mock LLM call incorrectly returns a subtopic that matches and existing
            // topic at first, and then on retry returns a correct categorization.
            mockGenerateData
                .mockReturnValueOnce(Promise.resolve([
                {
                    name: "Infrastructure",
                    subtopics: [{ name: "Roads" }, { name: "Environment" }],
                },
                {
                    name: "Environment",
                    subtopics: [{ name: "Parks" }],
                },
            ]))
                .mockReturnValueOnce(Promise.resolve(validResponse));
            const commentRecords = yield new sensemaker_1.Sensemaker(TEST_MODEL_SETTINGS).learnTopics(comments, includeSubtopics, topics);
            expect(mockGenerateData).toHaveBeenCalledTimes(2);
            expect(commentRecords).toEqual(validResponse);
        }));
        it("should retry topic modeling when a new topic is added", () => __awaiter(void 0, void 0, void 0, function* () {
            const comments = [
                { id: "1", text: "Comment about Roads" },
                { id: "2", text: "Comment about Parks" },
                { id: "3", text: "Another comment about Roads" },
            ];
            const includeSubtopics = true;
            const topics = [{ name: "Infrastructure" }, { name: "Environment" }];
            const validResponse = [
                {
                    name: "Infrastructure",
                    subtopics: [{ name: "Roads" }],
                },
                {
                    name: "Environment",
                    subtopics: [{ name: "Parks" }],
                },
            ];
            // Mock LLM call returns an incorrectly added new topic at first, and then
            // is correct on retry.
            mockGenerateData
                .mockReturnValueOnce(Promise.resolve([
                {
                    name: "Infrastructure",
                    subtopics: [{ name: "Roads" }],
                },
                {
                    name: "Environment",
                    subtopics: [{ name: "Parks" }],
                },
                {
                    name: "Economy",
                    subtopics: [],
                },
            ]))
                .mockReturnValueOnce(Promise.resolve(validResponse));
            const commentRecords = yield new sensemaker_1.Sensemaker(TEST_MODEL_SETTINGS).learnTopics(comments, includeSubtopics, topics);
            expect(mockGenerateData).toHaveBeenCalledTimes(2);
            expect(commentRecords).toEqual(validResponse);
        }));
    });
});
