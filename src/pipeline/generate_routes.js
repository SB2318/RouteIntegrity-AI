/**
 * generate_routes.js
 * 
 * Uses Gemini to generate 2-3 realistic routes between a source and destination.
 * Returns descriptions and approximate coordinates.
 */

import { callGemini } from '../llm/gemini.js';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    routes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          routeId: { type: 'string' },
          description: { type: 'string' },
          polyline: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
              description: "[lat, lng] coordinates"
            }
          }
        },
        required: ['routeId', 'description', 'polyline']
      }
    }
  },
  required: ['routes']
};

export async function generate_routes(source, destination) {
  const prompt = `
You are a geographic routing engine. 
Generate 2 to 3 distinct, realistic routes to travel from "${source}" to "${destination}".

For each route, provide:
1. A unique routeId (e.g., "route_1")
2. A short description of the path taken (e.g., "Fastest Route via Highway 1")
3. An approximate polyline array consisting of at least 5 [latitude, longitude] pairs representing the path from start to finish. 
Make the coordinates logically progress from the source to the destination.

Output strictly as JSON matching the schema.
`.trim();

  return await callGemini(prompt, RESPONSE_SCHEMA);
}
