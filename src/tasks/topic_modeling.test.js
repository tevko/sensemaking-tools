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
const topic_modeling_1 = require("./topic_modeling");
describe("generateTopicModelingPrompt", () => {
    it("should generate a prompt for learning top-level topics only (depth 1, no subtopics)", () => {
        const includeSubtopics = false;
        const prompt = (0, topic_modeling_1.generateTopicModelingPrompt)(includeSubtopics);
        expect(prompt).toEqual(topic_modeling_1.LEARN_TOPICS_PROMPT);
    });
    it("should generate a prompt for learning subtopics with given top-level topics (depth 2)", () => {
        const includeSubtopics = true;
        const parentTopics = [
            { name: "Economic Development" },
            { name: "Housing" },
            { name: "Infrastructure" },
        ];
        const expectedPrompt = (0, topic_modeling_1.learnSubtopicsPrompt)(parentTopics);
        const prompt = (0, topic_modeling_1.generateTopicModelingPrompt)(includeSubtopics, parentTopics);
        expect(prompt).toEqual(expectedPrompt);
    });
    it("should generate a prompt for learning topics and subtopics (depth 2, no given top-level topics)", () => {
        const includeSubtopics = true;
        const prompt = (0, topic_modeling_1.generateTopicModelingPrompt)(includeSubtopics);
        expect(prompt).toEqual(topic_modeling_1.LEARN_TOPICS_AND_SUBTOPICS_PROMPT);
    });
});
describe("learnedTopicsValid", () => {
    it('should allow "Other" subtopic to have the same name as "Other" topic', () => {
        const topics = [
            {
                name: "Other",
                subtopics: [{ name: "Other" }],
            },
        ];
        expect((0, topic_modeling_1.learnedTopicsValid)(topics)).toBe(true);
    });
});
