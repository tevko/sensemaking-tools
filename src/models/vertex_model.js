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
exports.RETRY_DELAY_MS = exports.MAX_RETRIES = exports.VertexModel = void 0;
exports.generateJSON = generateJSON;
// Module to interact with models available on Google Cloud's Model Garden, including Gemini and
// Gemma models. All available models are listed here: https://cloud.google.com/model-garden?hl=en
const vertexai_1 = require("@google-cloud/vertexai");
const model_1 = require("./model");
const types_1 = require("../types");
const sensemaker_utils_1 = require("../sensemaker_utils");
/**
 * Class to interact with models available through Google Cloud's Model Garden.
 */
class VertexModel extends model_1.Model {
    /**
     * Create a model object.
     * @param project - the Google Cloud Project ID, not the numberic project name
     * @param location - The Google Cloud Project location
     * @param modelName - the name of the model from Vertex AI's Model Garden to connect with, see
     * the full list here: https://cloud.google.com/model-garden
     */
    constructor(project, location, modelName = "gemini-1.5-pro-002", gKeyFileName) {
        super();
        this.vertexAI = new vertexai_1.VertexAI({
            project: project,
            location: location,
            googleAuthOptions: gKeyFileName ? {
                keyFilename: gKeyFileName
            } : undefined
        });
        this.modelName = modelName;
    }
    /**
     * Get generative model corresponding to structured data output specification as a JSON Schema specification.
     */
    getGenerativeModel(schema) {
        return this.vertexAI.getGenerativeModel(getModelParams(this.modelName, schema));
    }
    /**
     * Generate text based on the given prompt.
     * @param prompt the text including instructions and/or data to give the model
     * @returns the model response as a string
     */
    generateText(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const req = getRequest(prompt);
            const model = this.getGenerativeModel();
            const response = yield (0, sensemaker_utils_1.retryCall)(
            // call LLM
            function (request, model) {
                return __awaiter(this, void 0, void 0, function* () {
                    return (yield model.generateContentStream(request)).response;
                });
            }, 
            // Check if the response exists and contains a text field.
            function (response) {
                if (!response) {
                    console.error("Failed to get a model response.");
                    return false;
                }
                if (!response.candidates[0].content.parts[0].text) {
                    console.error(`Model returned a malformed response: ${response}`);
                    return false;
                }
                return true;
            }, exports.MAX_RETRIES, "Failed to get a valid model response.", exports.RETRY_DELAY_MS, [req, model], // Arguments for the LLM call
            [] // Arguments for the validator function
            );
            const responseText = response.candidates[0].content.parts[0].text;
            console.log(`Input token count: ${(_a = response.usageMetadata) === null || _a === void 0 ? void 0 : _a.promptTokenCount}`);
            console.log(`Output token count: ${(_b = response.usageMetadata) === null || _b === void 0 ? void 0 : _b.candidatesTokenCount}`);
            return responseText;
        });
    }
    /**
     * Generate structured data based on the given prompt.
     * @param prompt the text including instructions and/or data to give the model
     * @param schema a JSON Schema specification (generated from TypeBox)
     * @returns the model response as data structured according to the JSON Schema specification
     */
    generateData(prompt, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield generateJSON(prompt, this.getGenerativeModel(schema));
            if (!(0, types_1.checkDataSchema)(schema, response)) {
                // TODO: Add retry logic for this error.
                throw new Error("Model response does not match schema: " + response);
            }
            return response;
        });
    }
}
exports.VertexModel = VertexModel;
const safetySettings = [
    {
        category: vertexai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: vertexai_1.HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: vertexai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: vertexai_1.HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: vertexai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: vertexai_1.HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: vertexai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: vertexai_1.HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: vertexai_1.HarmCategory.HARM_CATEGORY_UNSPECIFIED,
        threshold: vertexai_1.HarmBlockThreshold.BLOCK_NONE,
    },
];
/**
 * Creates a model specification object for Vertex AI generative models.
 *
 * @param schema Optional. The JSON schema for the response. Only used if responseMimeType is 'application/json'.
 * @returns A model specification object ready to be used with vertex_ai.getGenerativeModel().
 */
function getModelParams(modelName, schema) {
    const modelParams = {
        model: modelName,
        generationConfig: {
            // Param docs: http://cloud/vertex-ai/generative-ai/docs/model-reference/inference#generationconfig
            maxOutputTokens: 8192,
            temperature: 0,
            topP: 0,
        },
        safetySettings: safetySettings,
    };
    if (schema && modelParams.generationConfig) {
        modelParams.generationConfig.responseMimeType = "application/json";
        modelParams.generationConfig.responseSchema = schema;
    }
    return modelParams;
}
// The maximum number of times an API call should be retried.
exports.MAX_RETRIES = 3;
// How long in miliseconds to wait between API calls.
exports.RETRY_DELAY_MS = 2000; // 2 seconds. TODO: figure out how to set it to zero for tests
function getRequest(prompt) {
    return {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
}
/**
 * Utility function for sending a set of instructions to an LLM with comments,
 * and returning the results as an array of JSON. It includes retry logic to handle rate limit
 * errors.
 *
 * @param instructions The instructions for the LLM on how to process the comments.
 * @param prompt The instructions for the LLM on how to process the comments.
 * @returns A Promise that resolves with the LLM's output parsed as a JSON object.
 * @throws An error if the LLM's response is malformed or if there's an error during processing.
 */
// TODO: Restrict access to this function. It is intended to only be available for testing. It can
// be made "protected" once it is a class method.
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function generateJSON(prompt, model) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const req = getRequest(prompt);
        const response = yield (0, sensemaker_utils_1.retryCall)(
        // call LLM
        function (request) {
            return __awaiter(this, void 0, void 0, function* () {
                return (yield model.generateContentStream(request)).response;
            });
        }, 
        // Check if the response exists and contains a text field.
        function (response) {
            if (!response) {
                console.error("Failed to get a model response.");
                return false;
            }
            if (!response.candidates[0].content.parts[0].text) {
                console.error(`Model returned a malformed response: ${response}`);
                return false;
            }
            return true;
        }, exports.MAX_RETRIES, "Failed to get a valid model response.", exports.RETRY_DELAY_MS, [req], // Arguments for the LLM call
        [] // Arguments for the validator function
        );
        const responseText = response.candidates[0].content.parts[0].text;
        console.log(`Input token count: ${(_a = response.usageMetadata) === null || _a === void 0 ? void 0 : _a.promptTokenCount}`);
        console.log(`Output token count: ${(_b = response.usageMetadata) === null || _b === void 0 ? void 0 : _b.candidatesTokenCount}`);
        return JSON.parse(responseText);
    });
}
