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
// Learns and assigns topics and subtopics to a CSV of comments.
// Input CSV must contain "comment_text" and "comment-id" fields
// Output CSV contains all input fields plus a new "topics" field which
// concatenates all topics and subtopics, e.g.
// "Transportation:PublicTransit;Transportation:Parking;Technology:Internet"
const vertex_model_1 = require("../src/models/vertex_model");
const sensemaker_1 = require("../src/sensemaker");
const commander_1 = require("commander");
const csv_parse_1 = require("csv-parse");
const csv_writer_1 = require("csv-writer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Parse command line arguments.
        const program = new commander_1.Command();
        program
            .option("-o, --outputFile <file>", "The output file name.")
            .option("-i, --inputFile <file>", "The input file name.")
            .option("-a, --additionalContext <instructions>", "A short description of the conversation to add context.")
            .option("-v, --vertexProject <project>", "The Vertex Project name.");
        program.parse(process.argv);
        const options = program.opts();
        const csvRows = yield readCsv(options.inputFile);
        const comments = convertCsvRowsToComments(csvRows);
        // Learn topics and categorize comments.
        const sensemaker = new sensemaker_1.Sensemaker({
            defaultModel: new vertex_model_1.VertexModel(options.vertexProject, "us-central1"),
        });
        const topics = yield sensemaker.learnTopics(comments, true);
        const categorizedComments = yield sensemaker.categorizeComments(comments, true, topics, options.additionalContext);
        const csvRowsWithTopics = setTopics(csvRows, categorizedComments);
        yield writeCsv(csvRowsWithTopics, options.outputFile);
    });
}
function readCsv(inputFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const allRows = [];
            fs.createReadStream(filePath)
                .pipe(parser)
                .on("error", (error) => reject(error))
                .on("data", (row) => {
                allRows.push(row);
            })
                .on("end", () => resolve(allRows));
        });
    });
}
function convertCsvRowsToComments(csvRows) {
    const comments = [];
    for (const row of csvRows) {
        comments.push({
            text: row["comment_text"],
            id: row["comment-id"],
        });
    }
    return comments;
}
function setTopics(csvRows, categorizedComments) {
    // Create a map from comment-id to csvRow
    const mapIdToCsvRow = {};
    for (const csvRow of csvRows) {
        const commentId = csvRow["comment-id"];
        mapIdToCsvRow[commentId] = csvRow;
    }
    // For each comment in categorizedComments
    //   lookup corresponding original csv row
    //   add a "topics" field that concatenates all topics/subtopics
    const csvRowsWithTopics = [];
    for (const comment of categorizedComments) {
        const csvRow = mapIdToCsvRow[comment.id];
        csvRow["topics"] = concatTopics(comment);
        csvRowsWithTopics.push(csvRow);
    }
    return csvRowsWithTopics;
}
// Returns topics and subtopics concatenated together like
// "Transportation:PublicTransit;Transportation:Parking;Technology:Internet"
function concatTopics(comment) {
    const pairsArray = [];
    for (const topic of comment.topics || []) {
        if ("subtopics" in topic) {
            for (const subtopic of topic.subtopics || []) {
                pairsArray.push(`${topic.name}:${subtopic.name}`);
            }
        }
        else {
            // handle case where no subtopics available
            pairsArray.push(`${topic.name}:`);
        }
    }
    return pairsArray.join(";");
}
function writeCsv(csvRows, outputFile) {
    return __awaiter(this, void 0, void 0, function* () {
        // Expect that all objects have the same keys, and make id match header title
        const header = [];
        for (const column of Object.keys(csvRows[0])) {
            header.push({ id: column, title: column });
        }
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: outputFile,
            header: header,
        });
        csvWriter.writeRecords(csvRows).then(() => console.log("CSV file written successfully."));
    });
}
main();
