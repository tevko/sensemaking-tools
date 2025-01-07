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
const types_1 = require("./types");
describe("Types Test", () => {
    it("The total votes should be the sum of all the different VoteTally values", () => {
        expect(new types_1.VoteTally(1, 2, 3).totalCount).toEqual(6);
        expect(new types_1.VoteTally(1, 2).totalCount).toEqual(3);
    });
    it("Valid VoteTallies should pass isVoteTallyType", () => {
        expect((0, types_1.isVoteTallyType)({ agreeCount: 2, disagreeCount: 12 })).toBeTruthy();
        expect((0, types_1.isVoteTallyType)({ agreeCount: 2, disagreeCount: 12, passCount: 0 })).toBeTruthy();
    });
    it("Invalid VoteTallies should fail isVoteTallyType", () => {
        expect((0, types_1.isVoteTallyType)({})).toBeFalsy();
        expect((0, types_1.isVoteTallyType)({ agreeCount: "2" })).toBeFalsy();
    });
    it("Valid Comment should pass isCommentType", () => {
        expect((0, types_1.isCommentType)({ id: "2", text: "hello" })).toBeTruthy();
        expect((0, types_1.isCommentType)({
            id: "2",
            text: "hello",
            voteTalliesByGroup: { "group 1": { agreeCount: 1, disagreeCount: 2 } },
        })).toBeTruthy();
    });
    it("Invalid Comment should fail isCommentType", () => {
        expect((0, types_1.isCommentType)({})).toBeFalsy();
        // Vote Tally counts must be of type number
        expect((0, types_1.isCommentType)({
            id: "2",
            text: "hello",
            voteTalliesByGroup: { "group 1": { agreeCount: "1", disagreeCount: "2" } },
        })).toBeFalsy();
    });
    it("Valid CommentRecord should pass isCommentRecordType", () => {
        expect((0, types_1.isCommentRecordType)({ id: "123", topics: [] })).toBeTruthy();
    });
    it("Invalid CommentRecord should fail isCommentRecordType", () => {
        // ID is required.
        expect((0, types_1.isCommentRecordType)({ topics: [{ name: "Healthcare" }] })).toBeFalsy();
        // ID must be of type string.
        expect((0, types_1.isCommentRecordType)({ id: 1, topics: [{ name: "Healthcare" }] })).toBeFalsy();
        // Topics must be valid, the second one is missing a name.
        expect((0, types_1.isCommentRecordType)({
            id: 1,
            topics: [{ name: "Healthcare" }, { subtopics: { name: "Public Parks" } }],
        })).toBeFalsy();
    });
    it("Valid Topics should pass isTopicType", () => {
        expect((0, types_1.isTopicType)({ name: "Test Topic" })).toBeTruthy();
        expect((0, types_1.isTopicType)({ name: "Test Topic", subtopics: [{ name: "Test Subtopic" }] })).toBeTruthy();
    });
    it("Invalid Topics should not pass isTopicType", () => {
        expect((0, types_1.isTopicType)({})).toBeFalsy();
        expect((0, types_1.isTopicType)({ name: 2 })).toBeFalsy();
        expect((0, types_1.isTopicType)({ name: 2, subtopics: [{}] })).toBeFalsy();
        // The object has one valid subtopic and one invalid subtopic.
        expect((0, types_1.isTopicType)({ name: "Test Topic", subtopics: [{ name: "Test Subtopic" }, {}] })).toBeFalsy();
    });
    describe("Summary", () => {
        describe("getText", () => {
            const chunks = [
                { text: "Claim 1 text", representativeCommentIds: ["id1", "id2"] },
                { text: " " }, // Filler text
                { text: "Claim 2 text.", representativeCommentIds: ["id3"] },
                { text: " Filler text" },
            ];
            const summary = new types_1.Summary(chunks, []);
            it("should return XML formatted summary", () => {
                const expectedXML = `Claim 1 text<citation comment_id=id1><citation comment_id=id2> Claim 2 text.<citation comment_id=id3> Filler text`;
                expect(summary.getText("XML")).toBe(expectedXML);
            });
            it("should return MARKDOWN formatted summary", () => {
                const expectedMarkdown = "Claim 1 text[id1,id2] Claim 2 text.[id3] Filler text";
                expect(summary.getText("MARKDOWN")).toBe(expectedMarkdown);
            });
            it("should throw an error for unsupported format", () => {
                expect(() => summary.getText("UNSUPPORTED")).toThrow("Unsupported citation type: UNSUPPORTED");
            });
        });
    });
});
