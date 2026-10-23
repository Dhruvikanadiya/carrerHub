const { callAgent } = require('./geminiClient');

const SYSTEM_INSTRUCTION = `You are a specialist Job Description Analyzer Agent in an ATS resume tailoring system.
Your job is to thoroughly analyze the provided job description and extract essential requirements.

Rules:
1. Extract the primary job title and company if mentioned.
2. Differentiate strictly between REQUIRED/MUST-HAVE skills and PREFERRED/NICE-TO-HAVE skills.
3. Extract core day-to-day responsibilities.
4. Extract minimum required qualifications (education, years of experience, certifications).
5. Extract important ATS keywords and domain terminologies.
6. Return ONLY a valid JSON object matching the requested schema. No conversational filler or markdown.`;

async function runJdAnalyzer(jobDescription) {
  const prompt = `Analyze this Job Description and return a JSON object with this exact shape:
{
  "roleTitle": "Target job title",
  "company": "Company name or empty string",
  "requiredSkills": ["skill 1", "skill 2"],
  "preferredSkills": ["skill 1", "skill 2"],
  "keyResponsibilities": ["responsibility 1", "responsibility 2"],
  "qualifications": ["degree or years of exp requirement"],
  "keywords": ["ATS keyword 1", "keyword 2"]
}

JOB DESCRIPTION:
${jobDescription}`;

  const result = await callAgent({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.1
  });

  const d = result.data || {};
  return {
    data: {
      roleTitle: d.roleTitle || 'Target Role',
      company: d.company || '',
      requiredSkills: Array.isArray(d.requiredSkills) ? d.requiredSkills : [],
      preferredSkills: Array.isArray(d.preferredSkills) ? d.preferredSkills : [],
      keyResponsibilities: Array.isArray(d.keyResponsibilities) ? d.keyResponsibilities : [],
      qualifications: Array.isArray(d.qualifications) ? d.qualifications : [],
      keywords: Array.isArray(d.keywords) ? d.keywords : []
    },
    tokens: result.tokens,
    timeTakenMs: result.timeTakenMs
  };
}

module.exports = { runJdAnalyzer };
