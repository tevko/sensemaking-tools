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

// Module to interact with models available on Google Cloud's Model Garden, including Gemini and
// Gemma models. All available models are listed here: https://cloud.google.com/model-garden?hl=en

import {
  GenerativeModel,
  HarmBlockThreshold,
  HarmCategory,
  ModelParams,
  Schema,
  VertexAI,
} from "@google-cloud/vertexai";
import { Model } from "./model";
import { checkDataSchema } from "../types";
import { TSchema, Static } from "@sinclair/typebox";
import { retryCall } from "../sensemaker_utils";

/**
 * Class to interact with models available through Google Cloud's Model Garden.
 */
export class VertexModel extends Model {
  private vertexAI: VertexAI;
  private modelName: string;

  /**
   * Create a model object.
   * @param project - the Google Cloud Project ID, not the numberic project name
   * @param location - The Google Cloud Project location
   * @param modelName - the name of the model from Vertex AI's Model Garden to connect with, see
   * the full list here: https://cloud.google.com/model-garden
   */
  constructor(project: string, location: string, modelName: string = "gemini-1.5-pro-002", gKeyFileName?: string) {
    super();
    this.vertexAI = new VertexAI({
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
  getGenerativeModel(schema?: TSchema): GenerativeModel {
    return this.vertexAI.getGenerativeModel(getModelParams(this.modelName, schema));
  }

  /**
   * Generate text based on the given prompt.
   * @param prompt the text including instructions and/or data to give the model
   * @returns the model response as a string
   */
  async generateText(prompt: string): Promise<string> {
    const req = getRequest(prompt);
    const model = this.getGenerativeModel();

    const response = await retryCall(
      // call LLM
      async function (request: Request, model: GenerativeModel) {
        return (await model.generateContentStream(request)).response;
      },
      // Check if the response exists and contains a text field.
      function (response): boolean {
        if (!response) {
          console.error("Failed to get a model response.");
          return false;
        }
        if (!response.candidates![0].content.parts[0].text) {
          console.error(`Model returned a malformed response: ${response}`);
          return false;
        }
        return true;
      },
      MAX_RETRIES,
      "Failed to get a valid model response.",
      RETRY_DELAY_MS,
      [req, model], // Arguments for the LLM call
      [] // Arguments for the validator function
    );

    const responseText = response.candidates![0].content.parts[0].text!;
    console.log(`Input token count: ${response.usageMetadata?.promptTokenCount}`);
    console.log(`Output token count: ${response.usageMetadata?.candidatesTokenCount}`);
    return responseText;
  }

  /**
   * Generate structured data based on the given prompt.
   * @param prompt the text including instructions and/or data to give the model
   * @param schema a JSON Schema specification (generated from TypeBox)
   * @returns the model response as data structured according to the JSON Schema specification
   */
  async generateData(prompt: string, schema: TSchema): Promise<Static<typeof schema>> {
    const response = await generateJSON(prompt, this.getGenerativeModel(schema));
    if (!checkDataSchema(schema, response)) {
      // TODO: Add retry logic for this error.
      throw new Error("Model response does not match schema: " + response);
    }
    return response;
  }
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

/**
 * Creates a model specification object for Vertex AI generative models.
 *
 * @param schema Optional. The JSON schema for the response. Only used if responseMimeType is 'application/json'.
 * @returns A model specification object ready to be used with vertex_ai.getGenerativeModel().
 */
function getModelParams(modelName: string, schema?: Schema): ModelParams {
  const modelParams: ModelParams = {
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
export const MAX_RETRIES = 3;
// How long in miliseconds to wait between API calls.
export const RETRY_DELAY_MS = 2000; // 2 seconds. TODO: figure out how to set it to zero for tests

type Request = {
  contents: {
    role: string;
    parts: { text: string }[];
  }[];
};
function getRequest(prompt: string): Request {
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
export async function generateJSON(prompt: string, model: GenerativeModel): Promise<any[]> {
  const req = getRequest(prompt);

  const response = await retryCall(
    // call LLM
    async function (request: Request) {
      return (await model.generateContentStream(request)).response;
    },
    // Check if the response exists and contains a text field.
    function (response): boolean {
      if (!response) {
        console.error("Failed to get a model response.");
        return false;
      }
      if (!response.candidates![0].content.parts[0].text) {
        console.error(`Model returned a malformed response: ${response}`);
        return false;
      }
      return true;
    },
    MAX_RETRIES,
    "Failed to get a valid model response.",
    RETRY_DELAY_MS,
    [req], // Arguments for the LLM call
    [] // Arguments for the validator function
  );

  const responseText: string = response.candidates![0].content.parts[0].text!;
  console.log(`Input token count: ${response.usageMetadata?.promptTokenCount}`);
  console.log(`Output token count: ${response.usageMetadata?.candidatesTokenCount}`);
  return JSON.parse(responseText);
}
