// src/confidence/ConfidenceReport.js — final per-dimension envelope, the module's public
// output shape. This is what src/server.js embeds as the additive `confidenceReport` field.

const engine = require('../core-engine');
const defaultConfig = require('../../config/confidenceConfig');
const ConfidenceEstimator = require('./ConfidenceEstimator');

// build(engineResult, config?) -> { RT: {score, confidence, evidenceStrength,
// evidenceCoverage, contradictionPenalty, metadata}, SC: {...}, ... }
//
// `score` is engineResult.finalVec[k] verbatim -- never recomputed, rounded, or otherwise
// touched here, so it is bit-identical to the raw engine output by construction.
function build(engineResult, config = defaultConfig) {
  const estimated = ConfidenceEstimator.estimate(engineResult, config);
  const report = {};
  engine.DIMS.forEach(k => {
    report[k] = { score: engineResult.finalVec[k], ...estimated[k] };
  });
  return report;
}

module.exports = { build };
