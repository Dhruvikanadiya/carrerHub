const { callAgent } = require('./geminiClient');

const SYSTEM_INSTRUCTION = `You are a specialist Resume Rewriter Agent in an ATS resume tailoring multi-agent system.
Your job is to rewrite and optimize the candidate's resume for the target job description.

CRITICAL TRUTH & INTEGRITY RULES:
1. NEVER INVENT OR HALLUCINATE: Do NOT add skills, projects, work experience, companies, degrees, certifications, or metrics not explicitly supported by the candidate's original resume.
2. If the JD requires a skill that the candidate does not have, DO NOT ADD IT. (The Gap Analyzer has already recorded it as missing).
3. OPTIMIZATION TECHNIQUES YOU SHOULD USE:
   - Reorder experiences, projects, and bullets so the most relevant existing accomplishments appear first.
   - Refine bullet phrasing with strong action verbs and professional ATS language while preserving the exact factual truth.
   - Align the professional summary with the target role using the candidate's actual qualifications.
   - Keep names, company names, dates, schools, and metrics exact.
4. If reviewer feedback is provided from a previous audit, you MUST address every single critique and remove any flagged content.
5. Return ONLY a valid JSON object matching the requested schema.`;

async function runResumeRewriter({ parsedResume, jdAnalysis, gapAnalysis, reviewerFeedback, attempt = 1 }) {
  let feedbackSection = '';
  if (reviewerFeedback) {
    feedbackSection = `
ATTENTION: PREVIOUS DRAFT WAS REJECTED BY THE REVIEWER AGENT.
You must strictly fix the following issues in this attempt (${attempt}):
Feedback: ${reviewerFeedback.feedback || 'Remove unsupported claims.'}
Flagged Hallucinations: ${JSON.stringify(reviewerFeedback.hallucinations || [])}
`;
  }

  const prompt = `${feedbackSection}
Optimize the candidate's resume for the job description using the provided analyses.
Return a JSON object with this exact shape:
{
  "tailoredResume": {
    "name": "${parsedResume.name || ''}",
    "contact": "${parsedResume.contact || ''}",
    "summary": "Tailored executive summary based purely on real background",
    "skills": ["Real skill 1", "Real skill 2"],
    "experience": [
      {
        "title": "Title",
        "company": "Company",
        "dates": "Dates",
        "bullets": ["Action verb + task + honest outcome"]
      }
    ],
    "projects": [
      {
        "name": "Project Name",
        "description": "Short description",
        "bullets": ["Key technical detail"]
      }
    ],
    "education": [
      {
        "degree": "Degree",
        "school": "School",
        "dates": "Dates",
        "details": "Details"
      }
    ],
    "certifications": ["Certification"],
    "other": "Other notes"
  },
  "changes": ["Specific change made 1", "Specific change 2"],
  "why": ["Rationale for changes based on JD"]
}

ORIGINAL PARSED RESUME:
${JSON.stringify(parsedResume, null, 2)}

JD ANALYSIS:
${JSON.stringify(jdAnalysis, null, 2)}

GAP ANALYSIS & PRIORITIZATION GUIDELINES:
${JSON.stringify(gapAnalysis, null, 2)}`;

  const result = await callAgent({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.2
  });

  const d = result.data || {};
  const t = d.tailoredResume || {};

  return {
    data: {
      tailoredResume: {
        name: t.name || parsedResume.name || '',
        contact: t.contact || parsedResume.contact || '',
        summary: t.summary || parsedResume.summary || '',
        skills: Array.isArray(t.skills) ? t.skills : parsedResume.skills || [],
        experience: Array.isArray(t.experience) ? t.experience : parsedResume.experience || [],
        projects: Array.isArray(t.projects) ? t.projects : parsedResume.projects || [],
        education: Array.isArray(t.education) ? t.education : parsedResume.education || [],
        certifications: Array.isArray(t.certifications) ? t.certifications : parsedResume.certifications || [],
        other: t.other || parsedResume.other || ''
      },
      changes: Array.isArray(d.changes) ? d.changes : [],
      why: Array.isArray(d.why) ? d.why : []
    },
    tokens: result.tokens,
    timeTakenMs: result.timeTakenMs
  };
}

module.exports = { runResumeRewriter };
