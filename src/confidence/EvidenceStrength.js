// src/confidence/EvidenceStrength.js — pure function of quantitative signals, NOT an
// independent per-sub evidence audit.
//
// (Note for future readers: an earlier line of exploration for this phase considered
// building EvidenceStrength from a per-sub-layer cited-evidence lookup -- e.g. only
// `nutrition`/`temperament`/`ace`/`loneliness` have any citation documented anywhere in this
// repo (docs/WEIGHTS.md, core-engine.js comments), so 44 of 48 subs would be "uncited" by
// construction. That approach was explicitly rejected in favor of this one: EvidenceStrength
// buckets the SAME composite ConfidenceEstimator computes from coverage/consistency/
// contradictions -- it is "confidence, categorized", not a second independently-justified
// number that could silently diverge from the first.)

const { EVIDENCE_STRENGTH_BUCKETS } = require('./ConfidenceTypes');
const defaultConfig = require('../../config/confidenceConfig');

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// compositeOf({coverage, consistency, contradictions}, config?) -> 0-100
// Same formula ConfidenceEstimator uses for `confidence` -- kept here (not just imported
// from there) because EvidenceStrength must stay a pure, standalone function per spec
// ("not independent" refers to it not inventing its own separate evidence source, not to
// code-sharing). ConfidenceEstimator.js calls THIS function rather than restating the
// formula, so there is exactly one place the composite is defined.
function compositeOf({ coverage, consistency, contradictions }, config = defaultConfig) {
  const w = config.weights;
  return clamp(coverage * w.coverage + consistency * w.consistency - contradictions * w.contradiction, 0, 100);
}

// strengthOf({coverage, consistency, contradictions}, config?) -> one of EVIDENCE_STRENGTH_BUCKETS
function strengthOf(signals, config = defaultConfig) {
  const composite = compositeOf(signals, config);
  const t = config.evidenceStrength.thresholds;
  if (composite < t.veryWeak) return 'Very Weak';
  if (composite < t.weak) return 'Weak';
  if (composite < t.moderate) return 'Moderate';
  if (composite < t.strong) return 'Strong';
  return 'Very Strong';
}

module.exports = { strengthOf, compositeOf, EVIDENCE_STRENGTH_BUCKETS };
