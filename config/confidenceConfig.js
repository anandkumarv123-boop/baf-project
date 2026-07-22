// config/confidenceConfig.js — mutable tunables for src/confidence/*.
//
// Plain module.exports object, deliberately NOT a set of `const` primitives. Phase 1
// (docs/validation/weight-validation.md) found empirically that SUBACUTE_WEIGHT,
// SAME_LAYER_PAIR_WEIGHT, and CROSS_LAYER_DISCOUNT in src/core-engine.js are `const`
// primitives closed over internally by computeEngine() -- mutating their exported copies is
// a verified no-op, because a primitive export is a value copy, not a live reference. An
// object export does not have that problem: every src/confidence/* module reads
// `config.weights.coverage` etc. *inside* its function bodies on every call, never
// destructured into a local `const` at require-time, so mutating this object's properties
// (as tests/confidence/mutability.test.js does) genuinely changes behavior on the next call.
// This is the direct fix for the failure mode Phase 1 documented, applied going forward.
//
// None of the defaults below are evidence-derived -- they are stated, documented judgment
// calls (same footing as SUBACUTE_WEIGHT/CROSS_LAYER_DISCOUNT in core-engine.js), tunable
// here rather than hardcoded, with rationale in docs/confidence-engine.md.
module.exports = {
  // Reuses the same "non-negligible signal" convention as scripts/consistency-check.js's
  // NEUTRAL_EPSILON (0.05 on the engine's -2..2 scale) for EvidenceCoverage's per-dimension
  // "touch" test. Not imported from there directly (that file's own const is fixed at 0.05
  // and not meant to be tuned per-consumer) -- restated here as this module's own mutable
  // copy of the same convention.
  neutralEpsilon: 0.05,

  // ConfidenceEstimator's composite: confidence = clamp(coverage*w.coverage +
  // consistency*w.consistency - contradiction*w.contradiction, 0, 100). Weights don't need
  // to sum to 1 -- the clamp absorbs any over/undershoot -- but coverage+consistency summing
  // to 0.8 and contradiction at 0.4 reflects that a full-coverage, fully-consistent profile
  // should land near (not necessarily at) 80 before any contradiction penalty, leaving room
  // for contradictions to pull a profile down without an unreachable ceiling.
  weights: { coverage: 0.5, consistency: 0.3, contradiction: 0.4 },

  // consistency_k dispersion stat (see ConfidenceEstimator): maxSpread=2 is half the engine's
  // -2..2 range -- a stdev at or above 2 among a dimension's touching subs is treated as
  // "no consistency left to credit", not literally the largest stdev mathematically possible
  // (which would be 4, per NEUTRAL_EPSILON's own use of 4 as contradiction's max range).
  // singleSampleDefault=100: with fewer than 2 touching subs there is no disagreement to
  // detect, so no penalty is applied by default -- a stated judgment call, not derived.
  consistency: { maxSpread: 2, singleSampleDefault: 100 },

  // ContradictionAnalyzer flags a dampener pair as a conflict once its max-dimension
  // divergence (0-100 scale, 100 = the two members are at opposite ends of the -2..2 clamp)
  // crosses this threshold. 50 = the two members disagree by at least half the maximum
  // possible range on at least one dimension -- a stated midpoint judgment call.
  contradiction: { flagThreshold: 50 },

  // EvidenceStrength buckets the same composite `confidence` uses (see EvidenceStrength.js)
  // into 5 labels. Thresholds are even 20-point bands -- a stated default, independently
  // tunable from the `weights` above (changing a threshold re-labels the same number without
  // changing what produced it).
  evidenceStrength: { thresholds: { veryWeak: 20, weak: 40, moderate: 60, strong: 80 } },
};
