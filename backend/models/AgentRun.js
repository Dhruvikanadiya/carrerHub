const mongoose = require('mongoose');

const agentRunSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication',
      default: null,
      index: true
    },
    timeTakenMs: {
      jdAnalyzer: { type: Number, default: 0 },
      resumeParser: { type: Number, default: 0 },
      gapAnalyzer: { type: Number, default: 0 },
      resumeRewriter: { type: Number, default: 0 },
      reviewer: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    tokensUsed: {
      promptTokens: { type: Number, default: 0 },
      candidateTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 }
    },
    retryCount: {
      type: Number,
      default: 0
    },
    matchScore: {
      type: Number,
      default: 0
    },
    finalReviewerStatus: {
      type: String,
      enum: ['Approved', 'Rejected', 'ApprovedWithWarnings'],
      default: 'Approved'
    },
    reviewerFeedback: {
      type: String,
      default: ''
    },
    matchedSkills: {
      type: [String],
      default: []
    },
    missingSkills: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AgentRun', agentRunSchema);
