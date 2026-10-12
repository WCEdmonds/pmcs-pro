import { GoogleGenerativeAI } from '@google/generative-ai';
import { inspectionTypeLabel } from './inspectionTypes';

export const GEMINI_KEY = 'pmcs_gemini_key';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (genAI) return genAI;
  const key = getApiKey();
  if (!key) return null;
  genAI = new GoogleGenerativeAI(key);
  return genAI;
}

export function setApiKey(key: string) {
  localStorage.setItem(GEMINI_KEY, key);
  genAI = new GoogleGenerativeAI(key);
}

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(GEMINI_KEY);
  } catch {
    return null;
  }
}

export function clearApiKey() {
  try {
    localStorage.removeItem(GEMINI_KEY);
  } catch {
    // ignore
  }
  genAI = null;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isRetryableModelError(msg: string): boolean {
  return /\b(429|404)\b|quota|not found|is not supported|RESOURCE_EXHAUSTED|overloaded|\b503\b/i.test(msg);
}

/** Turns SDK errors into something a soldier can act on. */
export function friendlyAiError(e: unknown): string {
  const msg = message(e);
  if (/API key not valid|API_KEY_INVALID|\b(400|401|403)\b.*key|PERMISSION_DENIED|invalid api key/i.test(msg)) {
    return 'Your Gemini API key was rejected. Check it in Settings.';
  }
  if (/No API key/i.test(msg)) return 'Add your Gemini API key in Settings to use AI.';
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return 'The AI is busy or your free quota is used up. Try again in a minute.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Can't reach the AI service. Check your connection.";
  return 'The AI could not answer right now. Try again later.';
}

export async function askAboutStep(
  question: string,
  context: {
    vehicleType: string;
    inspectionType?: string;
    zone: string;
    item: string;
    itemDescription: string;
    procedure: string;
    isNoGo: boolean;
    noGoCondition?: string;
  }
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('No API key configured. Add your Gemini API key in Settings.');

  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  const pmcsKind = context.inspectionType ? `${inspectionTypeLabel(context.inspectionType)} PMCS` : 'PMCS';
  const prompt = `You are an expert Army vehicle mechanic and PMCS instructor. A soldier is performing a ${pmcsKind} on a ${context.vehicleType} and has a question about the current inspection step.

Current step:
- Zone: ${context.zone}
- Item ${context.item}: ${context.itemDescription}
- Procedure: ${context.procedure}
${context.isNoGo ? `- This is a NO-GO item. NO-GO condition: ${context.noGoCondition}` : ''}

Soldier's question: ${question}

Give a concise, practical answer a soldier can use right now in the motor pool. Keep it under 3 sentences unless more detail is genuinely needed. Use plain language.`;

  let lastError: Error | null = null;
  for (const modelName of models) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Rate limited or model unavailable (404) — try the next model
      if (isRetryableModelError(lastError.message)) continue;
      throw lastError;
    }
  }
  throw lastError || new Error('All models failed');
}
