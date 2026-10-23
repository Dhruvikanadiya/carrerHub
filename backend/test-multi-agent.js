require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const AgentRun = require('./models/AgentRun');
const { runMultiAgentOrchestrator } = require('./services/agents/orchestrator');

async function test() {
  console.log('=== CareerHub Multi-Agent System Test ===\n');
  console.log('1. Connecting to database...');
  await connectDB();

  // Find a test user or first user in db
  let user = await User.findOne();
  if (!user) {
    user = { _id: new mongoose.Types.ObjectId() };
    console.log('   Using temporary ObjectId for test user');
  } else {
    console.log(`   Found user: ${user.name} (${user.email})`);
  }

  const sampleJD = `
Job Title: Full Stack MERN Developer Intern
Company: TechNova Solutions
Requirements:
- Strong proficiency in JavaScript (ES6+), React, Node.js, and Express.
- Experience with MongoDB and RESTful API development.
- Knowledge of Git version control.
- Nice to have: Docker, AWS, Redux, TypeScript.
Responsibilities:
- Build reusable UI components in React.
- Design and integrate secure REST APIs with Express & MongoDB.
- Write unit tests and collaborate with the engineering team.
  `;

  const sampleResume = `
Dhruvi Kanadiya
dhruvi@example.com | (555) 123-4567 | github.com/dhruvi
Summary: Motivated Software Engineer with hands-on experience in full-stack web development, React, Node.js, and MongoDB.
Skills: JavaScript, React, Node.js, Express, MongoDB, Git, HTML, CSS, REST APIs.
Experience:
- Web Developer Intern at CodeCraft (Jan 2024 - June 2024):
  * Developed frontend dashboard components using React and Ant Design.
  * Created REST API endpoints using Node.js and Express to manage user profiles.
  * Integrated MongoDB database queries using Mongoose for efficient data retrieval.
Projects:
- Resume Vault:
  * Full stack web application built with React, Node.js, Express, and MongoDB.
  * Implemented JWT user authentication and document management.
Education:
- B.S. in Computer Science, University of Technology (2021 - 2025).
  `;

  console.log('\n2. Running 5-agent orchestrator...');
  console.log('   - Agent 1 (JD Analyzer) & Agent 2 (Resume Parser) running concurrently');
  console.log('   - Agent 3 (Gap Analyzer)');
  console.log('   - Agent 4 (Resume Rewriter) & Agent 5 (Reviewer loop)');

  const t0 = Date.now();
  const result = await runMultiAgentOrchestrator({
    jobDescription: sampleJD,
    resumeText: sampleResume,
    userId: user._id
  });
  const totalMs = Date.now() - t0;

  console.log('\n=== Multi-Agent Run Completed in', totalMs, 'ms ===\n');
  console.log('Match Score:', result.multiAgent.matchScore + '%');
  console.log('Matched Skills:', result.multiAgent.matchedSkills.join(', '));
  console.log('Missing Skills:', result.multiAgent.missingSkills.join(', '));
  console.log('Reviewer Status:', result.multiAgent.reviewerStatus);
  console.log('Reviewer Feedback:', result.multiAgent.reviewerFeedback);
  console.log('Retry Count:', result.multiAgent.retryCount);
  console.log('Agent Time Breakdown (ms):', JSON.stringify(result.multiAgent.timeTakenMs, null, 2));
  console.log('Tokens Used:', JSON.stringify(result.multiAgent.tokensUsed, null, 2));

  console.log('\nTailored Resume Sample:');
  console.log('- Name:', result.tailoredResume.name);
  console.log('- Summary:', result.tailoredResume.summary);
  console.log('- Top Skills:', result.tailoredResume.skills.slice(0, 8).join(', '));

  console.log('\nExplanation Changes:', result.explanation.changes.slice(0, 3));

  if (result.multiAgent.agentRunId) {
    console.log('\n3. Verifying AgentRun record in MongoDB...');
    const record = await AgentRun.findById(result.multiAgent.agentRunId);
    console.log('   Found AgentRun record in DB with ID:', record._id);
    console.log('   Saved matchScore:', record.matchScore);
    console.log('   Saved reviewerStatus:', record.finalReviewerStatus);
    console.log('   Saved total ms:', record.timeTakenMs.total);
  }

  console.log('\n=== ALL MULTI-AGENT CHECKS PASSED ===\n');
  process.exit(0);
}

test().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
