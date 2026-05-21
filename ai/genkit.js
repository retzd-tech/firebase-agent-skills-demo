import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with the Google AI plugin
export const ai = genkit({
  plugins: [googleAI()],
  // Use the recommended model as per best practices
  model: googleAI.model('gemini-2.5-flash'),
});

export { z };
