const { callAgent } = require('./geminiClient');

const SYSTEM_INSTRUCTION = `You are a specialist Resume Parser Agent.
Your sole job is to parse raw text extracted from a candidate's resume and structure it into clean, standardized sections.

Hard rules:
1. NEVER invent, extrapolate, or assume anything. Use only the exact facts, skills, companies, dates, and metrics present in the resume text.
2. If a section is missing from the original resume, return an empty array or empty string for that section.
3. Separate technical and professional skills into clean individual items.
4. Keep work experiences and project bullets intact without losing details.
5. Return ONLY a valid JSON object matching the requested schema.`;

async function runResumeParser(resumeText) {
  const prompt = `Parse the following raw resume text into a structured JSON object with this exact shape:
{
  "name": "Candidate full name",
  "contact": "Email, phone, links, location",
  "summary": "Original summary or professional objective if present",
  "skills": ["JavaScript", "React", "Node.js"],
  "experience": [
    {
      "title": "Role title",
      "company": "Company name",
      "dates": "Dates worked",
      "bullets": ["Action bullet 1", "Action bullet 2"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "bullets": ["Detail bullet 1"]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "school": "Institution name",
      "dates": "Dates",
      "details": "GPA, honors, or coursework if present"
    }
  ],
  "certifications": ["Certification 1"],
  "other": "Awards, languages, or other notes if present"
}

RAW RESUME TEXT:
${resumeText}`;

  const result = await callAgent({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.1
  });

  const d = result.data || {};
  return {
    data: {
      name: d.name || '',
      contact: d.contact || '',
      summary: d.summary || '',
      skills: Array.isArray(d.skills) ? d.skills : [],
      experience: Array.isArray(d.experience) ? d.experience : [],
      projects: Array.isArray(d.projects) ? d.projects : [],
      education: Array.isArray(d.education) ? d.education : [],
      certifications: Array.isArray(d.certifications) ? d.certifications : [],
      other: d.other || ''
    },
    tokens: result.tokens,
    timeTakenMs: result.timeTakenMs
  };
}

module.exports = { runResumeParser };
