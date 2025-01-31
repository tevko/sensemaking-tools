import { Model } from "./model";
import { TSchema, Static } from "@sinclair/typebox";
import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";
import { retryCall } from "../sensemaker_utils";
import { checkDataSchema } from "../types";

// The maximum number of times an API call should be retried
const MAX_RETRIES = 3;
// How long in milliseconds to wait between API calls
const RETRY_DELAY_MS = 2000;

/**
 * Class to interact with Google AI Studio models.
 */
export class GoogleAIModel extends Model {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  /**
   * Create a model object.
   * @param apiKey - Google AI Studio API key
   * @param modelName - the name of the model to use (e.g. "gemini-1.0-pro")
   */
  constructor(apiKey: string, modelName: string = "gemini-1.0-pro") {
    super();
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.model = this.client.getGenerativeModel({ model: modelName });
  }

  /**
   * Generate text based on the given prompt.
   * @param prompt the text including instructions and/or data to give the model
   * @returns the model response as a string
   */
  async generateText(prompt: string): Promise<string> {
    const response = await retryCall(
      // call LLM
      async (prompt: string) => {
        const result = await this.model.generateContent(prompt);
        return result.response;
      },
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
    console.log(`Prompt tokens: ${response.usageMetadata?.promptTokenCount}`);
    return responseText;
  }

  /**
   * Generate structured data based on the given prompt.
   * @param prompt the text including instructions and/or data to give the model
   * @param schema a JSON Schema specification (generated from TypeBox)
   * @returns the model response as data structured according to the JSON Schema specification
   */
  async generateData(prompt: string, schema: TSchema): Promise<Static<typeof schema>> {
    // Configure the model for structured output
    const modelWithSchema = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0,
        topP: 0,
        topK: 1,
        maxOutputTokens: 8192,
      } as GenerationConfig,
    });

    const systemPrompt = `You must respond with valid JSON that matches this schema: ${JSON.stringify(schema)}. Only respond with the JSON, no other text.`;

    const response = await retryCall(
      // call LLM
      async (prompt: string, systemPrompt: string) => {
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
        const result = await chat.sendMessage(prompt);
        return result.response;
      },
      // Check if the response exists and contains valid JSON
      (response) => {
        // if (!response || !response.text()) {
        //   console.error("Failed to get a model response.");
        //   return false;
        // }
        // try {
        //   JSON.parse(response.text());
        //   return true;
        // } catch {
        //   console.error("Failed to parse response as JSON.");
        //   return false;
        // }
        return true
      },
      MAX_RETRIES,
      "Failed to get a valid model response.",
      RETRY_DELAY_MS,
      [prompt, systemPrompt], // Arguments for the LLM call
      [] // Arguments for the validator function
    );
    console.log(response, response.text())
    const parsedResponse = JSON.parse(response.text());

    if (!checkDataSchema(schema, parsedResponse)) {
      throw new Error("Model response does not match schema: " + JSON.stringify(parsedResponse));
    }

    console.log(`Prompt tokens: ${response.usageMetadata?.promptTokenCount}`);
    return parsedResponse;
  }
}
