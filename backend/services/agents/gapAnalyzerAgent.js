const { callAgent } = require('./geminiClient');

const SYSTEM_INSTRUCTION = `You are a specialist Gap Analyzer Agent in an ATS resume tailoring multi-agent system.
Your job is to compare the extracted Job Description requirements with the candidate's parsed Resume facts.

Your objectives:
1. Identify MATCHED SKILLS: Skills the candidate demonstrably has that align with the JD requirements.
2. Identify MISSING SKILLS: Skills or qualifications that the JD requires or prefers which are completely absent from the resume.
3. Compute an objective MATCH SCORE (an integer between 0 and 100):
   - Score should realistically reflect the coverage of required skills, responsibilities, and qualifications.
   - Do not inflate the score.
4. Highlight key candidate strengths relevant to this specific role.
5. Provide actionable prioritization advice for the Resume Rewriter agent (e.g. which actual projects or experiences should be elevated to the top).
6. Return ONLY valid JSON matching the requested schema.`;

async function runGapAnalyzer(jdAnalysis, parsedResume) {
  const prompt = `Compare this JD Analysis and Candidate Parsed Resume, then return a JSON object with this exact shape:
{
  "matchScore": 75,
  "matchedSkills": ["skill 1", "skill 2"],
  "missingSkills": ["missing skill 1", "missing skill 2"],
  "strengths": ["Clear strength 1 relevant to the JD", "Strength 2"],
  "gaps": ["Gap 1 that is missing from candidate background"],
  "prioritizationAdvice": ["Highlight project X first because it uses React and Node", "Emphasize API experience in job Y"]
}

JD ANALYSIS:
${JSON.stringify(jdAnalysis, null, 2)}

PARSED RESUME:
${JSON.stringify(parsedResume, null, 2)}`;

  const result = await callAgent({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.1
  });

  const d = result.data || {};
  let score = typeof d.matchScore === 'number' ? Math.round(d.matchScore) : parseInt(d.matchScore, 10);
  if (isNaN(score)) score = 50;
  score = Math.max(0, Math.min(100, score));

  return {
    data: {
      matchScore: score,
      matchedSkills: Array.isArray(d.matchedSkills) ? d.matchedSkills : [],
      missingSkills: Array.isArray(d.missingSkills) ? d.missingSkills : [],
      strengths: Array.isArray(d.strengths) ? d.strengths : [],
      gaps: Array.isArray(d.gaps) ? d.gaps : [],
      prioritizationAdvice: Array.isArray(d.prioritizationAdvice) ? d.prioritizationAdvice : []
    },
    tokens: result.tokens,
    timeTakenMs: result.timeTakenMs
  };
}

module.exports = { runGapAnalyzer };
