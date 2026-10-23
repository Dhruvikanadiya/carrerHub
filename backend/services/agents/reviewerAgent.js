const { callAgent } = require('./geminiClient');

const SYSTEM_INSTRUCTION = `You are a specialist Reviewer & Fact-Checking Auditor Agent in an ATS resume tailoring multi-agent system.
Your sole responsibility is to protect the integrity of the candidate's resume by comparing the rewritten draft against the ORIGINAL resume (the Ground Truth).

Auditing criteria:
1. Did the Rewriter add any skills, tools, or programming languages that were NOT in the original resume?
2. Did the Rewriter invent any fake metrics (e.g. inventing 'boosted revenue by 30%' when original had no such metric)?
3. Did the Rewriter change or fabricate company names, job titles, university names, degrees, or dates?
4. Did the Rewriter invent projects, certifications, or responsibilities not found in the original?

Decision policy:
- If NO fake facts or hallucinated skills are found: set approved: true, hallucinations: [], status: "Approved".
- If ANY fake facts, invented metrics, or unsupported skills are found: set approved: false, list every violation in hallucinations, status: "Rejected", and provide clear corrective feedback.
- Return ONLY valid JSON matching the requested schema.`;

async function runReviewer({ originalResume, rewrittenResume, jdAnalysis }) {
  const prompt = `Audit the rewritten resume against the original resume ground truth and return a JSON object with this exact shape:
{
  "approved": true,
  "confidenceScore": 95,
  "hallucinations": [
    "Specific invented item or metric if any"
  ],
  "feedback": "Actionable feedback for the rewriter on what must be removed or fixed",
  "status": "Approved"
}

ORIGINAL RESUME (GROUND TRUTH):
${JSON.stringify(originalResume, null, 2)}

REWRITTEN RESUME (UNDER REVIEW):
${JSON.stringify(rewrittenResume, null, 2)}

TARGET JD ANALYSIS:
${JSON.stringify(jdAnalysis, null, 2)}`;

  const result = await callAgent({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.1
  });

  const d = result.data || {};
  const approved = Boolean(d.approved && (!d.hallucinations || d.hallucinations.length === 0));

  let confidence = typeof d.confidenceScore === 'number' ? Math.round(d.confidenceScore) : parseInt(d.confidenceScore, 10);
  if (isNaN(confidence)) confidence = approved ? 95 : 50;

  return {
    data: {
      approved,
      confidenceScore: Math.max(0, Math.min(100, confidence)),
      hallucinations: Array.isArray(d.hallucinations) ? d.hallucinations : [],
      feedback: d.feedback || (approved ? 'All claims verified against original resume.' : 'Please remove unsupported claims.'),
      status: approved ? 'Approved' : 'Rejected'
    },
    tokens: result.tokens,
    timeTakenMs: result.timeTakenMs
  };
}

module.exports = { runReviewer };
