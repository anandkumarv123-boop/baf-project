// src/confidence/index.js — public entry point for the confidence engine.
//
// `build` (re-exported from ConfidenceReport.js) is the primary API: pass it a
// src/core-engine.js computeEngine() result, get back the per-dimension confidence envelope.
// Individual modules are also re-exported for direct/testable access (see tests/confidence/).

const ConfidenceReport = require('./ConfidenceReport');
const ConfidenceEstimator = require('./ConfidenceEstimator');
const EvidenceCoverage = require('./EvidenceCoverage');
const ContradictionAnalyzer = require('./ContradictionAnalyzer');
const EvidenceStrength = require('./EvidenceStrength');
const ConfidenceTypes = require('./ConfidenceTypes');

module.exports = {
  build: ConfidenceReport.build,
  ConfidenceReport,
  ConfidenceEstimator,
  EvidenceCoverage,
  ContradictionAnalyzer,
  EvidenceStrength,
  ConfidenceTypes,
};
