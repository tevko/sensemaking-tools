"use strict";
// Copyright 2025 Google LLC
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
exports.IntroSummary = void 0;
const recursive_summarization_1 = require("./recursive_summarization");
class IntroSummary extends recursive_summarization_1.RecursiveSummary {
    getSummary() {
        const commentCountFormatted = this.input.commentCount.toLocaleString();
        const voteCountFormatted = this.input.voteCount.toLocaleString();
        let text = `This report summarizes the results of public input, encompassing ` +
            `__${commentCountFormatted} comments__` +
            `${this.input.voteCount > 0 ? ` and __${voteCountFormatted} votes__` : ""}. All voters were anonymous. The ` +
            `public input collected covered a wide range of topics ` +
            `${this.input.containsSubtopics ? "and subtopics " : ""}` +
            `including:\n`;
        for (const topicStats of this.input.getStatsByTopic()) {
            text += ` * __${topicStats.name} (${topicStats.commentCount} comments)__\n`;
            if (!topicStats.subtopicStats) {
                continue;
            }
            const subtopics = topicStats.subtopicStats.map((subtopic) => {
                return `${subtopic.name} (${subtopic.commentCount})`;
            });
            text += "     * " + subtopics.join(", ") + "\n";
        }
        return Promise.resolve(`## Introduction

${text}`);
    }
}
exports.IntroSummary = IntroSummary;
