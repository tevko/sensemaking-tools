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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getTopicsAndSubtopics = getTopicsAndSubtopics;
exports.getSummary = getSummary;
exports.getCommentsFromCsv = getCommentsFromCsv;
exports.getTopicsFromComments = getTopicsFromComments;
// This code processes data from the `bin/` directory ingest scripts. In general, the shape
// takes the form of the `CoreCommentCsvRow` structure below, together with the vote tally
// columns as specified by `VoteTallyGroupKey`
const sensemaker_1 = require("../src/sensemaker");
const vertex_model_1 = require("../src/models/vertex_model");
const types_1 = require("../src/types");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const csv_parse_1 = require("csv-parse");
function getTopicsAndSubtopics(project, comments) {
    return __awaiter(this, void 0, void 0, function* () {
        const sensemaker = new sensemaker_1.Sensemaker({
            defaultModel: new vertex_model_1.VertexModel(project, "us-central1"),
        });
        return yield sensemaker.learnTopics(comments, true);
    });
}
function getSummary(project, comments, topics, additionalContext) {
    return __awaiter(this, void 0, void 0, function* () {
        const sensemaker = new sensemaker_1.Sensemaker({
            defaultModel: new vertex_model_1.VertexModel(project, "us-central1"),
        });
        return yield sensemaker.summarize(comments, types_1.SummarizationType.MULTI_STEP, topics, additionalContext);
    });
}
/**
 * Gets comments from a CSV file, in the style of the output from the input processing files
 * in the project's `bin/` directory. Core CSV rows are as for `CoreCommentCsvRow`, plus any
 * vote tallies in `VoteTallyCsvRow`.
 * @param inputFilePath
 * @returns
 */
function getCommentsFromCsv(inputFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        // Determine the number of groups from the header row
        const header = fs.readFileSync(inputFilePath, { encoding: "utf-8" }).split("\n")[0];
        const numGroups = new Set(header.match(/group-\d/g) || []).size;
        if (!inputFilePath) {
            throw new Error("Input file path is missing!");
        }
        const filePath = path.resolve(inputFilePath);
        const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
        const parser = (0, csv_parse_1.parse)(fileContent, {
            delimiter: ",",
            columns: true,
        });
        return new Promise((resolve, reject) => {
            const data = [];
            fs.createReadStream(filePath)
                .pipe(parser)
                .on("error", reject)
                .on("data", (row) => {
                if (row.moderated == -1) {
                    return;
                }
                const newComment = {
                    text: row.comment_text,
                    id: row["comment-id"].toString(),
                    voteTalliesByGroup: {},
                };
                const voteTalliesByGroup = {};
                for (let i = 0; i < numGroups; i++) {
                    const groupKey = `group-${i}`;
                    voteTalliesByGroup[groupKey] = new types_1.VoteTally(Number(row[`${groupKey}-agree-count`]), Number(row[`${groupKey}-disagree-count`]), Number(row[`${groupKey}-pass-count`]));
                }
                newComment.voteTalliesByGroup = voteTalliesByGroup;
                // Add topics and subtopics if available
                if (row.topic && row.subtopic) {
                    newComment.topics = [];
                    newComment.topics.push({
                        name: row.topic.toString(),
                        subtopics: [{ name: row.subtopic.toString() }],
                    });
                }
                data.push(newComment);
            })
                .on("end", () => resolve(data));
        });
    });
}
function getTopicsFromComments(comments) {
    // Create a map from the topic name to a set of subtopic names.
    const mapTopicToSubtopicSet = {};
    for (const comment of comments) {
        for (const topic of comment.topics || []) {
            if (mapTopicToSubtopicSet[topic.name] == undefined) {
                mapTopicToSubtopicSet[topic.name] = new Set();
            }
            if ("subtopics" in topic) {
                for (const subtopic of topic.subtopics || []) {
                    mapTopicToSubtopicSet[topic.name].add(subtopic.name);
                }
            }
        }
    }
    // Convert that map to a Topic array and return
    const returnTopics = [];
    for (const topicName in mapTopicToSubtopicSet) {
        const topic = { name: topicName, subtopics: [] };
        for (const subtopicName of mapTopicToSubtopicSet[topicName].keys()) {
            topic.subtopics.push({ name: subtopicName });
        }
        returnTopics.push(topic);
    }
    return returnTopics;
}
