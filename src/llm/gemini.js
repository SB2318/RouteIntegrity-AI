/**
 * gemini.js — Google Gemini API client wrapper
 *
 * Provides a single `callGemini(prompt, schema)` helper that:
 * - Sends a structured prompt to Gemini
 * - Enforces JSON output via response schema
 * - Returns the parsed JSON object
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    'Missing GEMINI_API_KEY environment variable. ' +
      'Copy .env.example → .env and fill in your key.'
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Call Gemini with a text prompt and receive a structured JSON response.
 *
 * @param {string} prompt         — The full prompt to send to the model
 * @param {object} responseSchema — A JSON Schema object describing the expected output
 * @param {string} [modelName]    — Model to use (default: gemini-2.0-flash)
 * @returns {Promise<object>}     — Parsed JSON response from the model
 */
export async function callGemini(
  prompt,
  responseSchema,
  modelName = 'gemini-2.0-flash'
) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1, // Low temperature → deterministic, consistent decisions
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text}`);
  }
}
