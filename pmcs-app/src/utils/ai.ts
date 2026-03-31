import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (genAI) return genAI;
  const key = localStorage.getItem('pmcs_gemini_key');
  if (!key) return null;
  genAI = new GoogleGenerativeAI(key);
  return genAI;
}

export function setApiKey(key: string) {
  localStorage.setItem('pmcs_gemini_key', key);
  genAI = new GoogleGenerativeAI(key);
}

export function getApiKey(): string | null {
  return localStorage.getItem('pmcs_gemini_key');
}

export function clearApiKey() {
  localStorage.removeItem('pmcs_gemini_key');
  genAI = null;
}

export async function askAboutStep(
  question: string,
  context: { vehicleType: string; zone: string; item: string; itemDescription: string; procedure: string; isNoGo: boolean; noGoCondition?: string }
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('No API key configured. Add your Gemini API key in Settings.');

  // Try flash first, fall back to flash-lite if rate limited
  const models = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError: Error | null = null;

  for (const modelName of models) {
    try {
      const model = client.getGenerativeModel({ model: modelName });

  const prompt = `You are an expert Army vehicle mechanic and PMCS instructor. A soldier is performing a Before-operation PMCS on a ${context.vehicleType} and has a question about the current inspection step.

Current step:
- Zone: ${context.zone}
- Item ${context.item}: ${context.itemDescription}
- Procedure: ${context.procedure}
${context.isNoGo ? `- This is a NO-GO item. NO-GO condition: ${context.noGoCondition}` : ''}

Soldier's question: ${question}

Give a concise, practical answer a soldier can use right now in the motor pool. Keep it under 3 sentences unless more detail is genuinely needed. Use plain language.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // If rate limited (429), try next model
      if (lastError.message.includes('429') || lastError.message.includes('quota')) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('All models failed');
}
