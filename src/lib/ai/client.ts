import OpenAI from 'openai';

const mimo = new OpenAI({
  apiKey: process.env.MIMO_API_KEY,
  baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1',
});

export default mimo;

export const MODELS = {
  clarify: 'mimo-v2.5-pro',
  moderate: 'mimo-v2.5-pro',
  fast: 'mimo-v2.5',
} as const;
