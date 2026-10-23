const { runJdAnalyzer } = require('./jdAnalyzerAgent');
const { runResumeParser } = require('./resumeParserAgent');
const { runGapAnalyzer } = require('./gapAnalyzerAgent');
const { runResumeRewriter } = require('./resumeRewriterAgent');
const { runReviewer } = require('./reviewerAgent');
const AgentRun = require('../../models/AgentRun');

/**
 * Runs the 5-agent resume tailoring system.
 * Agents 1 & 2 run in parallel.
 * Agents 4 & 5 run in an audit loop with up to 2 retries.
 * Persists metrics in AgentRun.
 */
async function runMultiAgentOrchestrator({
  jobDescription,
  resumeText,
  userId = null,
  applicationId = null
}) {
  const orchestratorStartTime = Date.now();

  const timeBreakdown = {
    jdAnalyzer: 0,
    resumeParser: 0,
    gapAnalyzer: 0,
    resumeRewriter: 0,
    reviewer: 0,
    total: 0
  };

  const tokensAccumulator = {
    promptTokens: 0,
    candidateTokens: 0,
    totalTokens: 0
  };

  function addTokens(tokenObj) {
    if (!tokenObj) return;
    tokensAccumulator.promptTokens += tokenObj.promptTokens || 0;
    tokensAccumulator.candidateTokens += tokenObj.candidateTokens || 0;
    tokensAccumulator.totalTokens += tokenObj.totalTokens || 0;
  }

  // ── Step 1: Run Agent 1 (JD Analyzer) & Agent 2 (Resume Parser) concurrently ──
  const [jdResult, resumeResult] = await Promise.all([
    runJdAnalyzer(jobDescription),
    runResumeParser(resumeText)
  ]);

  timeBreakdown.jdAnalyzer = jdResult.timeTakenMs;
  timeBreakdown.resumeParser = resumeResult.timeTakenMs;
  addTokens(jdResult.tokens);
  addTokens(resumeResult.tokens);

  const jdAnalysis = jdResult.data;
  const parsedResume = resumeResult.data;

  // ── Step 2: Run Agent 3 (Gap Analyzer) ─────────────────────────────────────────
  const gapResult = await runGapAnalyzer(jdAnalysis, parsedResume);
  timeBreakdown.gapAnalyzer = gapResult.timeTakenMs;
  addTokens(gapResult.tokens);
  const gapAnalysis = gapResult.data;

  // ── Step 3: Run Agent 4 (Rewriter) & Agent 5 (Reviewer) with up to 2 retries ─
  let retries = 0;
  const maxRetries = 2; // maximum 2 retries as requested
  let reviewerFeedback = null;
  let finalRewritten = null;
  let finalReview = null;

  while (retries <= maxRetries) {
    // Run Agent 4 (Resume Rewriter)
    const rewriteResult = await runResumeRewriter({
      parsedResume,
      jdAnalysis,
      gapAnalysis,
      reviewerFeedback,
      attempt: retries + 1
    });

    timeBreakdown.resumeRewriter += rewriteResult.timeTakenMs;
    addTokens(rewriteResult.tokens);
    finalRewritten = rewriteResult.data;

    // Run Agent 5 (Reviewer) to audit rewritten resume against original
    const reviewResult = await runReviewer({
      originalResume: parsedResume,
      rewrittenResume: finalRewritten.tailoredResume,
      jdAnalysis
    });

    timeBreakdown.reviewer += reviewResult.timeTakenMs;
    addTokens(reviewResult.tokens);
    finalReview = reviewResult.data;

    // If approved, exit loop immediately
    if (finalReview.approved) {
      break;
    }

    // If rejected and we have retries remaining, loop again
    if (retries < maxRetries) {
      retries++;
      console.warn(`[MultiAgentOrchestrator] Reviewer rejected attempt ${retries}. Retrying rewriter with feedback...`);
      reviewerFeedback = {
        feedback: finalReview.feedback,
        hallucinations: finalReview.hallucinations
      };
    } else {
      console.warn('[MultiAgentOrchestrator] Max retries reached (2). Proceeding with best audited version.');
      break;
    }
  }

  timeBreakdown.total = Date.now() - orchestratorStartTime;

  const finalStatus = finalReview?.approved
    ? 'Approved'
    : retries >= maxRetries
    ? 'ApprovedWithWarnings'
    : 'Rejected';

  // ── Step 4: Persist AgentRun document if user is provided ─────────────────────
  let savedRun = null;
  if (userId) {
    try {
      savedRun = await AgentRun.create({
        user: userId,
        application: applicationId || null,
        timeTakenMs: timeBreakdown,
        tokensUsed: tokensAccumulator,
        retryCount: retries,
        matchScore: gapAnalysis.matchScore || 0,
        finalReviewerStatus: finalStatus,
        reviewerFeedback: finalReview?.feedback || '',
        matchedSkills: gapAnalysis.matchedSkills || [],
        missingSkills: gapAnalysis.missingSkills || []
      });
    } catch (saveErr) {
      console.error('[MultiAgentOrchestrator] Failed to save AgentRun record:', saveErr.message);
    }
  }

  // ── Step 5: Format response for frontend & PDF generation compatibility ───────
  return {
    tailoredResume: finalRewritten.tailoredResume,
    explanation: {
      changes: finalRewritten.changes || [],
      why: finalRewritten.why || [],
      jdInfluences: gapAnalysis.strengths || [],
      prioritized: gapAnalysis.matchedSkills || [],
      missingFromResume: gapAnalysis.missingSkills || []
    },
    multiAgent: {
      agentRunId: savedRun?._id || null,
      matchScore: gapAnalysis.matchScore || 0,
      matchedSkills: gapAnalysis.matchedSkills || [],
      missingSkills: gapAnalysis.missingSkills || [],
      retryCount: retries,
      reviewerStatus: finalStatus,
      reviewerFeedback: finalReview?.feedback || '',
      confidenceScore: finalReview?.confidenceScore || 0,
      hallucinations: finalReview?.hallucinations || [],
      timeTakenMs: timeBreakdown,
      tokensUsed: tokensAccumulator
    }
  };
}

module.exports = { runMultiAgentOrchestrator };
