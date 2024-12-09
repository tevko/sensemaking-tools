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

import { VertexModel } from "../models/vertex_model";
import {
  formatCitations,
  groundSummary,
  parseStringIntoSummary,
  voteTallySummary,
  commentCitation,
} from "./grounding";
import { SummaryChunk, VoteTally, Comment } from "../types";

// Mock the model response. This mock needs to be set up to return response specific for each test.
let mockgenerateText: jest.SpyInstance;
const mockModel = new VertexModel("project", "location", "gemini-1000");

function mockgenerateTextSequence(responses: string[]) {
  responses.forEach((response) => mockgenerateText.mockReturnValueOnce(response));
}

describe("grounding test", () => {
  beforeEach(() => {
    mockgenerateText = jest.spyOn(VertexModel.prototype, "generateText");
  });

  afterEach(() => {
    mockgenerateText.mockRestore();
  });

  describe("markdown link formatter", () => {
    it("should format markdown links correctly", () => {
      const comments = [
        { id: "1", text: "I like cats" },
        { id: "2", text: "I don't like cats" },
      ];
      const summary = "This is a great summary[1,2]";
      const expectedOutput = `This is a great summary[[1](## "I like cats"), [2](## "I don't like cats")]`;
      expect(formatCitations(comments, summary)).toEqual(expectedOutput);
    });
    it("should format markdown links correctly with voteTallies", () => {
      const comments = [
        {
          id: "1",
          text: "I like cats",
          voteTalliesByGroup: {
            "0": { agreeCount: 10, disagreeCount: 5, passCount: 0, totalCount: 16 },
          },
        },
        {
          id: "2",
          text: "I don't like cats",
          voteTalliesByGroup: {
            "0": { agreeCount: 5, disagreeCount: 10, passCount: 6, totalCount: 20 },
          },
        },
      ];
      const summary = "This is a great summary[1,2]";
      const expectedOutput = `This is a great summary[[1](## "I like cats\nvotes: group-0(Agree=10, Disagree=5, Pass=0)"), [2](## "I don't like cats\nvotes: group-0(Agree=5, Disagree=10, Pass=6)")]`;
      expect(formatCitations(comments, summary)).toEqual(expectedOutput);
    });
  });

  describe("summarization grounding", () => {
    it("should format markdown correctly", async () => {
      const inputSummary = "This is a filler text. This is a grounded claim. This one not so much.";
      // Here we mock out the entire sequence of model responses that might result from such a summary grounding.
      // In theory, it would be fine to only mock the final return value (to return every time), but it's helpful
      // to see what the intermediate responses look like, and will be more future proof if additional processing ends
      // up happening between these steps.
      const responseSequence = [
        "This is a filler text. [[This is a grounded claim.]]^[] [[This one not so much.]]^[]",
        "This is a filler text. [[This is a grounded claim.]]^[id1,id2] [[This one not so much.]]^[id2]",
        "This is a filler text. [[This is a grounded claim.]]^[id1] [[This one not so much.]]^[]",
        "This is a filler text. [[This is a grounded claim.]]^[id1]",
      ];
      const comments = [
        { id: "id1", text: "A comment backing up the claim" },
        { id: "id2", text: "A comment that might look related but not really" },
      ];
      const expectedOutput = `This is a filler text. This is a grounded claim.[id1]`;
      // Install the mocks and run the grounding
      mockgenerateTextSequence(responseSequence);
      const groundedSummary = await groundSummary(mockModel, inputSummary, comments);
      expect(groundedSummary.getText("MARKDOWN")).toEqual(expectedOutput);
      expect(mockgenerateText).toHaveBeenCalledTimes(responseSequence.length);
    });
  });

  describe("string to summary parsing", () => {
    it("should parse a string with grounded claims into an array of SummaryChunks", async () => {
      const groundingResult = `This is a filler text.
[[Grounded [[inception]] claim...]]^[id1] [[Deeply, fully grounded claim.]]^[id2,id3][[Claim with no space in front]]^[id4,id5,id6]
Finally, this is another filler text.`;
      const expectedChunks: SummaryChunk[] = [
        { text: "This is a filler text.\n" },
        {
          text: "Grounded [[inception]] claim...",
          representativeCommentIds: ["id1"],
        },
        { text: " " },
        {
          text: "Deeply, fully grounded claim.",
          representativeCommentIds: ["id2", "id3"],
        },
        {
          text: "Claim with no space in front",
          representativeCommentIds: ["id4", "id5", "id6"],
        },
        { text: "\nFinally, this is another filler text." },
      ];

      const summary = await parseStringIntoSummary(groundingResult, []);
      expect(summary.chunks).toEqual(expectedChunks);
    });
  });

  describe("voteTallySummary", () => {
    it("should return an empty string if voteTalliesByGroup is undefined", () => {
      const comment: Comment = {
        id: "123",
        text: "test comment",
      };
      expect(voteTallySummary(comment)).toBe("");
    });

    it("should return a formatted string with vote tallies when voteTalliesByGroup is defined", () => {
      const comment: Comment = {
        id: "123",
        text: "test comment",
        voteTalliesByGroup: {
          group1: new VoteTally(10, 5),
          group2: new VoteTally(15, 2, 3),
        },
      };
      expect(voteTallySummary(comment)).toBe(
        "votes: group-group1(Agree=10, Disagree=5, Pass=undefined) group-group2(Agree=15, Disagree=2, Pass=3)"
      );
    });
  });
});

describe("commentCitation", () => {
  it("should format a comment citation correctly without vote tallies", () => {
    const comment: Comment = {
      id: "123",
      text: "This is a test comment.",
    };
    expect(commentCitation(comment)).toBe(`[123](## "This is a test comment.")`);
  });

  it("should format a comment citation correctly with vote tallies", () => {
    const comment: Comment = {
      id: "123",
      text: "This is a test comment.",
      voteTalliesByGroup: {
        group1: {
          agreeCount: 10,
          disagreeCount: 5,
          passCount: 1,
          totalCount: 16,
        },
        group2: {
          agreeCount: 15,
          disagreeCount: 2,
          passCount: 3,
          totalCount: 20,
        },
      },
    };
    expect(commentCitation(comment)).toBe(
      `[123](## "This is a test comment.\nvotes: group-group1(Agree=10, Disagree=5, Pass=1) group-group2(Agree=15, Disagree=2, Pass=3)")`
    );
  });

  it("should handle comments with single quotes", () => {
    const comment: Comment = {
      id: "123",
      text: "This is a 'test' comment with 'single quotes'.",
    };
    expect(commentCitation(comment)).toBe(
      `[123](## "This is a 'test' comment with 'single quotes'.")`
    );
  });

  it("should handle comments with double quotes", () => {
    const comment: Comment = {
      id: "123",
      text: 'This is a "test" comment with "double quotes".',
    };
    expect(commentCitation(comment)).toBe(
      `[123](## "This is a \\"test\\" comment with \\"double quotes\\".")`
    );
  });

  it("should handle comments with newlines", () => {
    const comment: Comment = {
      id: "123",
      text: "This is a test comment\nwith newlines.",
    };
    expect(commentCitation(comment)).toBe(`[123](## "This is a test comment with newlines.")`);
  });
});
