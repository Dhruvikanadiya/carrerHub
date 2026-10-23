const { GoogleGenerativeAI } = require('@google/generative-ai');
const { extractAndParseJson } = require('../../utils/jsonHelper');

function extractJson(text) {
  return extractAndParseJson(text);
}

/**
 * Invokes Gemini with structured JSON output expectation.
 * Automatically retries once if the model returns invalid JSON.
 */
async function callAgent({ systemInstruction, prompt, temperature = 0.2 }) {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server'), {
      statusCode: 500
    });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash'
  ].filter(Boolean);

  const uniqueModels = [...new Set(modelsToTry)];
  const fullPrompt = `${systemInstruction ? `${systemInstruction}\n\n` : ''}${prompt}`;

  let attempts = 0;
  const maxJsonAttempts = 2; // initial call + 1 retry on invalid JSON
  let lastError = null;

  const startTime = Date.now();
  let accumulatedTokens = {
    promptTokens: 0,
    candidateTokens: 0,
    totalTokens: 0
  };

  while (attempts < maxJsonAttempts) {
    attempts++;
    const currentPrompt = attempts > 1
      ? `${fullPrompt}\n\nIMPORTANT: Return ONLY valid, RFC-compliant JSON. Do NOT include trailing commas, unquoted property names, or comments.`
      : fullPrompt;

    for (const modelName of uniqueModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: attempts > 1 ? 0.0 : temperature,
            responseMimeType: 'application/json'
          }
        });

        const result = await model.generateContent(currentPrompt);

        // Record token metrics if provided by model
        const usage = result.response?.usageMetadata;
        if (usage) {
          accumulatedTokens.promptTokens += usage.promptTokenCount || 0;
          accumulatedTokens.candidateTokens += usage.candidatesTokenCount || 0;
          accumulatedTokens.totalTokens += usage.totalTokenCount || 0;
        }

        const rawText = result.response.text();
        const parsed = extractJson(rawText);

        return {
          data: parsed,
          tokens: accumulatedTokens,
          timeTakenMs: Date.now() - startTime
        };
      } catch (err) {
        lastError = err;
        // If it's a network/demand error, try the next model candidate
        if (err.message && (err.message.includes('503') || err.message.includes('404') || err.message.includes('fetch'))) {
          console.warn(`[geminiClient] Model ${modelName} unavailable (${err.message}). Trying fallback model...`);
          continue;
        }
        // If it's a JSON parse error, break out to trigger the agent retry
        console.warn(`[geminiClient] Attempt ${attempts} JSON parse error: ${err.message}. Retrying with strict JSON instruction...`);
        break;
      }
    }
  }

  throw Object.assign(
    new Error(lastError?.message || 'Agent failed to return valid JSON after retry.'),
    { statusCode: 502 }
  );
}

module.exports = {
  callAgent,
  extractJson
};

