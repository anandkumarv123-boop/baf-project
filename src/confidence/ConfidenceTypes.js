// src/confidence/ConfidenceTypes.js — shared constants and shape documentation for the
// confidence engine. No logic lives here; every other module in this directory imports
// EVIDENCE_STRENGTH_BUCKETS from here rather than restating the list.

// Ordered low -> high. EvidenceStrength.strengthOf() always returns one of these exact
// strings -- tests/confidence/EvidenceStrength.test.js asserts membership in this array
// rather than hardcoding its own copy of the list.
const EVIDENCE_STRENGTH_BUCKETS = ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Very Strong'];

/**
 * @typedef {Object} DimensionConfidence
 * @property {number} score - engineResult.finalVec[dim], verbatim (bit-identical to the raw
 *   engine output -- never recomputed or rounded differently here).
 * @property {number} confidence - 0-100. ConfidenceEstimator's composite for this dimension.
 * @property {'Very Weak'|'Weak'|'Moderate'|'Strong'|'Very Strong'} evidenceStrength -
 *   the same composite, categorized (see EvidenceStrength.js).
 * @property {number} evidenceCoverage - 0-100. See EvidenceCoverage.js.
 * @property {number} contradictionPenalty - 0-100. See ContradictionAnalyzer.js.
 * @property {Object} metadata - supporting detail (touching subs/layers, flagged conflicts)
 *   for explainability; see ConfidenceEstimator.js for exact fields.
 *
 * Deliberately absent: `reliability`. Deferred to Phase 3 (pending a multi-submission data
 * model this phase does not have) -- not included here even as null/placeholder, per an
 * explicit instruction not to stub it.
 */

/**
 * @typedef {Object.<string, DimensionConfidence>} ConfidenceReportShape
 * Keyed by src/core-engine.js's DIMS: RT, SC, ER, AR, DS, SR.
 */

module.exports = { EVIDENCE_STRENGTH_BUCKETS };
