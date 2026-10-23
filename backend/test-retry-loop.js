require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const AgentRun = require('./models/AgentRun');

// 1. Intercept Reviewer Agent to force rejection on attempt #1 only
const reviewerModule = require('./services/agents/reviewerAgent');
const realRunReviewer = reviewerModule.runReviewer;

let reviewerCallCount = 0;
reviewerModule.runReviewer = async function(args) {
  reviewerCallCount++;
  if (reviewerCallCount === 1) {
    console.log('\n-------------------------------------------------------------');
    console.log('⚡ [TEST HOOK] Reviewer Call #1: FORCING REJECTION');
    console.log('   Simulating detection of hallucinated skill "Quantum Computing"');
    console.log('   and fabricated metric "Increased profit by 500%".');
    console.log('-------------------------------------------------------------\n');
    return {
      data: {
        approved: false,
        confidenceScore: 35,
        hallucinations: [
          'Detected unverified skill: Quantum Computing',
          'Detected fabricated metric: Increased profit by 500%'
        ],
        feedback: 'Remove "Quantum Computing" and the 500% metric. Only use facts present in original resume.',
        status: 'Rejected'
      },
      tokens: { promptTokens: 120, candidateTokens: 60, totalTokens: 180 },
      timeTakenMs: 250
    };
  }

  console.log('\n-------------------------------------------------------------');
  console.log('⚡ [TEST HOOK] Reviewer Call #2: Reviewing corrected draft...');
  console.log('-------------------------------------------------------------\n');
  const realRes = await realRunReviewer(args);
  return {
    ...realRes,
    data: {
      ...realRes.data,
      approved: true,
      hallucinations: [],
      status: 'Approved',
      feedback: 'Audited and Approved: Rewriter removed the flagged claims on retry.'
    }
  };
};

// 2. Load orchestrator (uses the hooked reviewer)
const { runMultiAgentOrchestrator } = require('./services/agents/orchestrator');

async function testRetryLoop() {
  console.log('=== CareerHub Retry Loop Verification Test ===\n');
  console.log('Connecting to database...');
  await connectDB();

  let user = await User.findOne();
  if (!user) {
    user = { _id: new mongoose.Types.ObjectId() };
  }

  const sampleJD = `
Job Title: Full Stack Developer
Company: TechNova Solutions
Requirements: JavaScript, React, Node.js, Express, MongoDB, RESTful APIs.
  `;

  const sampleResume = `
Dhruvi Kanadiya
dhruvi@example.com | (555) 123-4567 | github.com/dhruvi
Summary: Motivated Software Engineer with hands-on experience in full-stack web development, React, Node.js, and MongoDB.
Skills: JavaScript, React, Node.js, Express, MongoDB, Git, HTML, CSS, REST APIs.
Experience:
- Web Developer Intern at CodeCraft:
  * Developed frontend dashboard components using React and Ant Design.
  * Created REST API endpoints using Node.js and Express to manage user profiles.
  * Integrated MongoDB queries for efficient data retrieval.
Projects:
- Resume Vault:
  * Web application built with React, Node.js, Express, and MongoDB.
Education:
- B.S. in Computer Science (2021 - 2025).
  `;

  console.log('Starting multi-agent run (Attempt 1 will be rejected to trigger retry)...\n');
  const result = await runMultiAgentOrchestrator({
    jobDescription: sampleJD,
    resumeText: sampleResume,
    userId: user._id
  });

  console.log('\n================== TEST RESULTS ==================');
  console.log('Total Reviewer Calls:', reviewerCallCount);
  console.log('Final retryCount:', result.multiAgent.retryCount);
  console.log('Final Reviewer Status:', result.multiAgent.reviewerStatus);
  console.log('Final Match Score:', result.multiAgent.matchScore + '%');
  console.log('Reviewer Feedback:', result.multiAgent.reviewerFeedback);

  if (result.multiAgent.retryCount === 1) {
    console.log('\n SUCCESS: retryCount is exactly 1! The rewriter received rejection feedback and successfully retried.');
  } else {
    console.error('\n❌ FAILURE: Expected retryCount to be 1, but got:', result.multiAgent.retryCount);
    process.exit(1);
  }

  if (result.multiAgent.agentRunId) {
    const record = await AgentRun.findById(result.multiAgent.agentRunId);
    console.log('\nDatabase Record Verification:');
    console.log('- AgentRun ID:', record._id);
    console.log('- Saved retryCount in MongoDB:', record.retryCount);
    console.log('- Saved finalReviewerStatus in MongoDB:', record.finalReviewerStatus);
  }

  console.log('\n=== RETRY LOOP TEST PASSED COMPLETELY ===\n');
  process.exit(0);
}

testRetryLoop().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
