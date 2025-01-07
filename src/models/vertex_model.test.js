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
const typebox_1 = require("@sinclair/typebox");
const vertex_model_1 = require("./vertex_model");
// Mock the VertexAI module - this mock will be used when the module is imported within a test run.
jest.mock("@google-cloud/vertexai", () => {
    // Mock the model response. This mock needs to be set up to return response specific for each test.
    const generateContentStreamMock = jest.fn();
    return {
        // Mock `generateContentStream` function within VertexAI module
        VertexAI: jest.fn(() => ({
            getGenerativeModel: jest.fn(() => ({
                generateContentStream: generateContentStreamMock,
            })),
        })),
        // Expose the mocked function, so we can get it within a test using `jest.requireMock`, and spy on its invocations.
        generateContentStreamMock: generateContentStreamMock,
        // Mock other imports from VertexAI module
        HarmBlockThreshold: {},
        HarmCategory: {},
        SchemaType: { ARRAY: 0, OBJECT: 1, STRING: 2 },
    };
});
function mockSingleModelResponse(generateContentStreamMock, responseMock) {
    generateContentStreamMock.mockImplementationOnce(() => Promise.resolve({
        response: {
            candidates: [{ content: { parts: [{ text: responseMock }] } }],
        },
    }));
}
describe("VertexAI test", () => {
    const model = new vertex_model_1.VertexModel("my-project", "us-central1", "models/gemini-pro");
    const { generateContentStreamMock } = jest.requireMock("@google-cloud/vertexai");
    beforeEach(() => {
        // Reset the mock before each test
        generateContentStreamMock.mockClear();
    });
    // These tests are specifically for the VertexModel class logic, rather than the implementation logic of the VertexAI calls
    describe("generateContent", () => {
        it("should retry on rate limit error and return valid JSON", () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedJSON = [{ result: "success" }];
            // Mock the first call to throw a rate limit error
            generateContentStreamMock.mockImplementationOnce(() => {
                throw new Error("429 Too Many Requests");
            });
            // Mock the second call to return the expected JSON
            mockSingleModelResponse(generateContentStreamMock, JSON.stringify(expectedJSON));
            const result = yield (0, vertex_model_1.generateJSON)("Some instructions", model.getGenerativeModel());
            // Assert that the mock was called twice (initial call + retry)
            expect(generateContentStreamMock).toHaveBeenCalledTimes(2);
            // Assert that the result is the expected JSON
            expect(result).toEqual(expectedJSON);
        }));
        it("should generate valid text", () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedText = "This is some text.";
            mockSingleModelResponse(generateContentStreamMock, expectedText);
            const result = yield model.generateText("Some instructions");
            expect(generateContentStreamMock).toHaveBeenCalledTimes(1);
            expect(result).toEqual(expectedText);
        }));
        it("should generate valid structured data that matches the schema", () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedStructuredData = { key1: "value1", key2: 2 };
            // the TypeBox spec:
            const schema = typebox_1.Type.Object({
                key1: typebox_1.Type.String(),
                key2: typebox_1.Type.Number(),
            });
            mockSingleModelResponse(generateContentStreamMock, JSON.stringify(expectedStructuredData));
            const result = yield model.generateData("Some instructions", schema);
            expect(generateContentStreamMock).toHaveBeenCalledTimes(1);
            expect(result).toEqual(expectedStructuredData);
        }));
        it("should throw an error when generated data does not match the schema", () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedStructuredData = { key1: 1, key2: "value2" };
            // the TypeBox spec:
            const schema = typebox_1.Type.Object({
                key1: typebox_1.Type.String(),
                key2: typebox_1.Type.Number(),
            });
            mockSingleModelResponse(generateContentStreamMock, JSON.stringify(expectedStructuredData));
            yield expect(() => __awaiter(void 0, void 0, void 0, function* () {
                yield model.generateData("Some instructions", schema);
            })).rejects.toThrow("Model response does not match schema");
        }));
    });
});
