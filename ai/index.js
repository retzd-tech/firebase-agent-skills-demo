import { ai, z } from './genkit.js';

export const greetingFlow = ai.defineFlow(
  {
    name: 'greetingFlow',
    inputSchema: z.string().describe('The name of the user to greet.'),
    outputSchema: z.string().describe('A personalized, friendly greeting message.'),
  },
  async (name) => {
    const response = await ai.generate({
      // The model defaults to 'gemini-2.5-flash' based on ai/genkit.js config
      prompt: `Write a very friendly, short, and enthusiastic greeting for someone named ${name}. Include a positive wish for their day.`,
    });
    
    return response.text;
  }
);
