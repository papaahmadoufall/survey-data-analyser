'use server';
/**
 * @fileOverview Identifies key performance indicators (KPIs) from numerical survey responses.
 *
 * - detectKpis - A function that analyzes survey data to identify impactful KPIs using correlation analysis.
 * - DetectKpisInput - The input type for the detectKpis function.
 * - DetectKpisOutput - The return type for the detectKpis function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const DetectKpisInputSchema = z.object({
  surveyData: z.array(z.record(z.any())).describe('Array of survey responses; each response is an object.'),
  language: z.string().optional().describe('Language of the survey data. Defaults to English (en).'),
});
export type DetectKpisInput = z.infer<typeof DetectKpisInputSchema>;

const DetectKpisOutputSchema = z.object({
  kpis: z.array(z.string()).describe('List of identified key performance indicators.'),
  explanation: z.string().describe('Explanation of why these KPIs are important.'),
});
export type DetectKpisOutput = z.infer<typeof DetectKpisOutputSchema>;

export async function detectKpis(input: DetectKpisInput): Promise<DetectKpisOutput> {
  return detectKpisFlow(input);
}

const detectKpisPrompt = ai.definePrompt({
  name: 'detectKpisPrompt',
  input: {
    schema: z.object({
      surveyData: z.array(z.record(z.any())).describe('Array of survey responses; each response is an object.'),
      language: z.string().optional().describe('Language of the survey data. Defaults to English (en).'),
    }),
  },
  output: {
    schema: z.object({
      kpis: z.array(z.string()).describe('List of identified key performance indicators.'),
      explanation: z.string().describe('Explanation of why these KPIs are important.'),
    }),
  },
  prompt: `You are an expert data analyst specializing in survey data.

  Analyze the provided survey data to identify the key performance indicators (KPIs).
  A KPI is a numerical data point which has the highest correlation to all the other numerical data points.
  Consider only the numerical survey responses when identifying KPIs.
  Return a list of the names of the columns which have a numerical datatype, and are KPIs.
  Also explain the reasoning behind why these data points are KPIs.

  {{#if language}}
  Note: The survey data is in {{language}} language. Please consider language-specific nuances when identifying KPIs. Column names and values may be in {{language}}.
  {{/if}}

  Survey Data: {{{surveyData}}}
  `,
});

const detectKpisFlow = ai.defineFlow<
  typeof DetectKpisInputSchema,
  typeof DetectKpisOutputSchema
>(
  {
    name: 'detectKpisFlow',
    inputSchema: DetectKpisInputSchema,
    outputSchema: DetectKpisOutputSchema,
  },
  async input => {
    const maxRetries = 3;
    let retries = 0;
    let delay = 2000; // Initial delay of 2 seconds

    while (retries < maxRetries) {
      try {
        const {output} = await detectKpisPrompt(input);
        return output!;
      } catch (error: any) {
        if (error.message.includes('429 Too Many Requests')) {
          console.warn(`Rate limit exceeded. Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          retries++;
        } else {
          // If it's not a rate limit error, re-throw the error
          throw error;
        }
      }
    }

    throw new Error('Failed to detect KPIs after multiple retries due to rate limiting.');
  }
);
