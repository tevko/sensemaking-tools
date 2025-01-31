"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAIModel = void 0;
const model_1 = require("./model");
const generative_ai_1 = require("@google/generative-ai");
const sensemaker_utils_1 = require("../sensemaker_utils");
const types_1 = require("../types");
// The maximum number of times an API call should be retried
const MAX_RETRIES = 3;
// How long in milliseconds to wait between API calls
const RETRY_DELAY_MS = 2000;
/**
 * Class to interact with Google AI Studio models.
 */
class GoogleAIModel extends model_1.Model {
  /**
   * Create a model object.
   * @param apiKey - Google AI Studio API key
   * @param modelName - the name of the model to use (e.g. "gemini-1.0-pro")
   */
  constructor(apiKey, modelName = "gemini-1.0-pro") {
    super();
    this.client = new generative_ai_1.GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.model = this.client.getGenerativeModel({ model: modelName });
  }
  /**
   * Generate text based on the given prompt.
   * @param prompt the text including instructions and/or data to give the model
   * @returns the model response as a string
   */
  generateText(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const response = yield (0, sensemaker_utils_1.retryCall)(
        // call LLM
        (prompt) =>
          __awaiter(this, void 0, void 0, function* () {
            const result = yield this.model.generateContent(prompt);
            return result.response;
          }),
        // Check if the response exists and contains text
        (response) => {
          if (!response || !response.text()) {
            console.error("Failed to get a model response.");
            return false;
          }
          return true;
        },
        MAX_RETRIES,
        "Failed to get a valid model response.",
        RETRY_DELAY_MS,
        [prompt], // Arguments for the LLM call
        [] // Arguments for the validator function
      );
      const responseText = response.text();
      console.log(
        `Prompt tokens: ${(_a = response.usageMetadata) === null || _a === void 0 ? void 0 : _a.promptTokenCount}`
      );
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
      var _a;
      // Configure the model for structured output
      const modelWithSchema = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 0,
          topP: 0,
          topK: 1,
          maxOutputTokens: 2048,
        },
      });
      const systemPrompt = `You must respond with valid JSON that matches this schema: ${JSON.stringify(schema)}. Only respond with the JSON, no other text.`;
      const response = yield (0, sensemaker_utils_1.retryCall)(
        // call LLM
        (prompt, systemPrompt) =>
          __awaiter(this, void 0, void 0, function* () {
            const chat = modelWithSchema.startChat({
              history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                {
                  role: "model",
                  parts: [
                    {
                      text: "I understand. I will only respond with valid JSON matching the provided schema.",
                    },
                  ],
                },
              ],
            });
            const result = yield chat.sendMessage(prompt);
            return result.response;
          }),
        // Check if the response exists and contains valid JSON
        (response) => {
          if (!response || !response.text()) {
            console.error("Failed to get a model response.");
            return false;
          }
          try {
            JSON.parse(response.text());
            return true;
          } catch (_a) {
            console.error("Failed to parse response as JSON.");
            return false;
          }
        },
        MAX_RETRIES,
        "Failed to get a valid model response.",
        RETRY_DELAY_MS,
        [prompt, systemPrompt], // Arguments for the LLM call
        [] // Arguments for the validator function
      );
      const parsedResponse = JSON.parse(response.text());
      if (!(0, types_1.checkDataSchema)(schema, parsedResponse)) {
        throw new Error("Model response does not match schema: " + JSON.stringify(parsedResponse));
      }
      console.log(
        `Prompt tokens: ${(_a = response.usageMetadata) === null || _a === void 0 ? void 0 : _a.promptTokenCount}`
      );
      return parsedResponse;
    });
  }
}
exports.GoogleAIModel = GoogleAIModel;
