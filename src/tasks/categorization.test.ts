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

import {
  findMissingComments,
  generateCategorizationPrompt,
  validateCommentRecords,
  categorizeWithRetry,
} from "./categorization";
import { CommentRecord, Comment, Topic } from "../types";
import { VertexModel } from "../models/vertex_model";

// Mock the model response. This mock needs to be set up to return response specific for each test.
let mockGenerateData: jest.SpyInstance;

describe("CategorizationTest", () => {
  beforeEach(() => {
    mockGenerateData = jest.spyOn(VertexModel.prototype, "generateData");
  });

  afterEach(() => {
    mockGenerateData.mockRestore();
  });
  it("should retry categorization with all missing comments", async () => {
    const comments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
      { id: "3", text: "Comment 3" },
    ];
    const includeSubtopics = false;
    const instructions = "Categorize the comments based on these topics:  [{'name': 'Topic 1'}]";
    const commentsWithTextAndTopics = [
      {
        id: "1",
        text: "Comment 1",
        topics: [{ name: "Topic 1", subtopics: [] }],
      },
      {
        id: "2",
        text: "Comment 2",
        topics: [{ name: "Topic 1", subtopics: [] }],
      },
      {
        id: "3",
        text: "Comment 3",
        topics: [{ name: "Topic 1", subtopics: [] }],
      },
    ];

    // The first response is incorrectly missing all comments, and then
    // on retry the text is present.
    mockGenerateData
      .mockReturnValueOnce(Promise.resolve([]))
      .mockReturnValueOnce(Promise.resolve(commentsWithTextAndTopics));

    const commentRecords = await categorizeWithRetry(
      new VertexModel("project", "location", "gemini-1000"),
      instructions,
      comments,
      includeSubtopics,
      [{ name: "Topic 1", subtopics: [] }]
    );

    expect(mockGenerateData).toHaveBeenCalledTimes(2);
    expect(commentRecords).toEqual(commentsWithTextAndTopics);
  });

  it("should retry categorization with some missing comments", async () => {
    const comments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
      { id: "3", text: "Comment 3" },
    ];
    const includeSubtopics = false;
    const instructions = "Categorize the comments based on these topics:  [{'name': 'Topic 1'}]";
    const commentsWithTextAndTopics = [
      {
        id: "1",
        text: "Comment 1",
        topics: [{ name: "Topic 1", subtopics: [] }],
      },
      {
        id: "2",
        text: "Comment 2",
        topics: [{ name: "Topic 1", subtopics: [] }],
      },
      {
        id: "3",
        text: "Comment 3",
        topics: [{ name: "Topic 1", subtopics: [] }],
      },
    ];

    // The first mock response includes only one comment, and for the next
    // response the two missing comments are returned.
    mockGenerateData
      .mockReturnValueOnce(Promise.resolve([commentsWithTextAndTopics[0]]))
      .mockReturnValueOnce(
        Promise.resolve([commentsWithTextAndTopics[1], commentsWithTextAndTopics[2]])
      );

    const commentRecords = await categorizeWithRetry(
      new VertexModel("project", "location", "gemini-1000"),
      instructions,
      comments,
      includeSubtopics,
      [{ name: "Topic 1", subtopics: [] }]
    );

    expect(mockGenerateData).toHaveBeenCalledTimes(2);
    expect(commentRecords).toEqual(commentsWithTextAndTopics);
  });

  it('should assign "Other" topic and "Uncategorized" subtopic to comments that failed categorization after max retries', async () => {
    const comments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
      { id: "3", text: "Comment 3" },
    ];
    const topics = '[{"name": "Topic 1", "subtopics": []}]';
    const instructions = "Categorize the comments based on these topics: " + topics;
    const includeSubtopics = true;
    const topicsJson = [{ name: "Topic 1", subtopics: [] }];

    // Mock the model to always return an empty response. This simulates a
    // categorization failure.
    mockGenerateData.mockReturnValue(Promise.resolve([]));

    const commentRecords = await categorizeWithRetry(
      new VertexModel("project", "location", "gemini-1000"),
      instructions,
      comments,
      includeSubtopics,
      topicsJson
    );

    expect(mockGenerateData).toHaveBeenCalledTimes(3);

    const expected = [
      {
        id: "1",
        text: "Comment 1",
        topics: [{ name: "Other", subtopics: [{ name: "Uncategorized" }] }],
      },
      {
        id: "2",
        text: "Comment 2",
        topics: [{ name: "Other", subtopics: [{ name: "Uncategorized" }] }],
      },
      {
        id: "3",
        text: "Comment 3",
        topics: [{ name: "Other", subtopics: [{ name: "Uncategorized" }] }],
      },
    ];
    expect(commentRecords).toEqual(expected);
  });

  it('should assign "Other" topic to comments that failed categorization after max retries', async () => {
    const comments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
      { id: "3", text: "Comment 3" },
    ];
    const topics = '[{"name": "Topic 1", "subtopics": []}]';
    const instructions = "Categorize the comments based on these topics: " + topics;
    const includeSubtopics = false;
    const topicsJson = [{ name: "Topic 1", subtopics: [] }];

    // Mock the model to always return an empty response. This simulates a
    // categorization failure.
    mockGenerateData.mockReturnValue(Promise.resolve([]));

    const commentRecords = await categorizeWithRetry(
      new VertexModel("project", "location", "gemini-1000"),
      instructions,
      comments,
      includeSubtopics,
      topicsJson
    );

    expect(mockGenerateData).toHaveBeenCalledTimes(3);

    const expected = [
      {
        id: "1",
        text: "Comment 1",
        topics: [{ name: "Other" }],
      },
      {
        id: "2",
        text: "Comment 2",
        topics: [{ name: "Other" }],
      },
      {
        id: "3",
        text: "Comment 3",
        topics: [{ name: "Other" }],
      },
    ];

    expect(commentRecords).toEqual(expected);
  });

  it("should generate a 1-level categorization prompt (topics only)", () => {
    const sampleTopics: Topic[] = [{ name: "Economic Development" }, { name: "Housing" }];
    const includeSubtopics = false;
    const prompt = generateCategorizationPrompt(sampleTopics, includeSubtopics);
    expect(prompt).toContain(
      "For each of the following comments, identify the most relevant topic from the list below."
    );
    expect(prompt).toContain("Economic Development");
  });

  it("should generate a 2-level categorization prompt (topics and subtopics)", () => {
    const sampleTopics: Topic[] = [
      {
        name: "Economic Development",
        subtopics: [{ name: "Job Creation" }, { name: "Business Growth" }],
      },
      {
        name: "Housing",
        subtopics: [{ name: "Affordable Housing Options" }, { name: "Rental Market Prices" }],
      },
    ];
    const includeSubtopics = true;
    const prompt = generateCategorizationPrompt(sampleTopics, includeSubtopics);
    expect(prompt).toContain(
      "For each of the following comments, identify the most relevant topic and subtopic from the list below."
    );
    expect(prompt).toContain("Economic Development");
    expect(prompt).toContain("Job Creation");
  });
});

describe("validateCommentRecord", () => {
  const inputComments: Comment[] = [
    { id: "1", text: "Comment 1" },
    { id: "2", text: "Comment 2" },
  ];

  const topics: Topic[] = [
    { name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] },
    { name: "Topic 2", subtopics: [{ name: "Subtopic 2" }] },
  ];

  it("should return all comments as valid with correct input", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [{ name: "Subtopic 2" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(2);
    expect(commentsWithInvalidTopics.length).toBe(0);
  });

  it("should filter out extra comments", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [{ name: "Subtopic 2" }] }],
      },
      {
        id: "3",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(2);
    expect(commentsWithInvalidTopics.length).toBe(0);
  });

  it("should filter out comments with empty topics", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
      { id: "2", topics: [] },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(1);
    expect(commentsWithInvalidTopics.length).toBe(1);
  });

  it("should filter out comments with empty subtopics", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(1);
    expect(commentsWithInvalidTopics.length).toBe(1);
  });

  it("should filter out comments with invalid topic names", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
      {
        id: "2",
        topics: [{ name: "Invalid Topic", subtopics: [{ name: "Subtopic 2" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(1);
    expect(commentsWithInvalidTopics.length).toBe(1);
  });

  it("should filter out a comment with one valid and one invalid topic name", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [
          { name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] },
          { name: "Invalid Topic", subtopics: [{ name: "Subtopic 2" }] },
        ],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [{ name: "Subtopic 2" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(1); // Only Comment 2 should pass
    expect(commentsWithInvalidTopics.length).toBe(1); // Comment 1 should fail
  });

  it("should filter out comments with invalid subtopic names", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Topic 1", subtopics: [{ name: "Subtopic 1" }] }],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [{ name: "Invalid Subtopic" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(1);
    expect(commentsWithInvalidTopics.length).toBe(1);
  });

  it("should filter out a comment with one valid and one invalid subtopic name", () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [
          {
            name: "Topic 1",
            subtopics: [{ name: "Subtopic 1" }, { name: "Invalid Subtopic" }],
          },
        ],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [{ name: "Subtopic 2" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(1); // Only Comment 2 should pass
    expect(commentsWithInvalidTopics.length).toBe(1); // Comment 1 should fail
  });

  it('should allow "Other" as a valid topic or subtopic name', () => {
    const commentRecords: CommentRecord[] = [
      {
        id: "1",
        topics: [{ name: "Other", subtopics: [{ name: "Other Subtopic 1" }] }],
      },
      {
        id: "2",
        topics: [{ name: "Topic 2", subtopics: [{ name: "Other" }] }],
      },
    ];
    const { commentsPassedValidation, commentsWithInvalidTopics } = validateCommentRecords(
      commentRecords,
      inputComments,
      true,
      topics
    );
    expect(commentsPassedValidation.length).toBe(2);
    expect(commentsWithInvalidTopics.length).toBe(0);
  });
});

describe("findMissingComments", () => {
  it("should return an empty array when all comments are present", () => {
    const commentRecords: CommentRecord[] = [
      { id: "1", topics: [] },
      { id: "2", topics: [] },
    ];
    const inputComments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
    ];
    const missingComments = findMissingComments(commentRecords, inputComments);
    expect(missingComments).toEqual([]);
  });

  it("should return missing comments when some are not present", () => {
    const commentRecords: CommentRecord[] = [{ id: "1", topics: [] }];
    const inputComments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
      { id: "3", text: "Comment 3" },
    ];
    const missingComments = findMissingComments(commentRecords, inputComments);
    expect(missingComments).toEqual([
      { id: "2", text: "Comment 2" },
      { id: "3", text: "Comment 3" },
    ]);
  });

  it("should return all comments when none are present", () => {
    const commentRecords: CommentRecord[] = [];
    const inputComments: Comment[] = [
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
    ];
    const missingComments = findMissingComments(commentRecords, inputComments);
    expect(missingComments).toEqual([
      { id: "1", text: "Comment 1" },
      { id: "2", text: "Comment 2" },
    ]);
  });
});