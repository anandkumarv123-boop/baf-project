// src/confidence/ConfidenceEstimator.js — orchestrates EvidenceCoverage, ContradictionAnalyzer,
// and an inline "consistency" stat into a single per-dimension confidence composite.
//
// `consistency` is computed here rather than in its own file: it is a straightforward
// dispersion stat (population stdev of touching subs' values at a dimension, across ALL
// answered subs -- not just the two dampener pairs ContradictionAnalyzer looks at), not
// complex enough on its own to warrant a module. It is deliberately a DIFFERENT signal from
// ContradictionAnalyzer's contradictionPenalty: consistency asks "does all the evidence for
// this dimension broadly agree", while contradictionPenalty asks the narrower, dampener-aware
// question "do the two specific subs the engine already treats as overlapping disagree".

const engine = require('../core-engine');
const defaultConfig = require('../../config/confidenceConfig');
const EvidenceCoverage = require('./EvidenceCoverage');
const ContradictionAnalyzer = require('./ContradictionAnalyzer');
const EvidenceStrength = require('./EvidenceStrength');

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function stdev(values) {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

// computeConsistency(engineResult, config?) -> { RT: 0-100, ... }
function computeConsistency(engineResult, config = defaultConfig) {
  const epsilon = config.neutralEpsilon;
  const consistency = {};
  engine.DIMS.forEach(k => {
    const touchingValues = engine.ALL_SUB_IDS
      .map(id => engineResult.subScores[id])
      .filter(v => v !== null && Math.abs(v[k]) > epsilon)
      .map(v => v[k]);

    if (touchingValues.length < 2) {
      consistency[k] = config.consistency.singleSampleDefault;
      return;
    }
    const spread = stdev(touchingValues);
    consistency[k] = Math.round((1 - clamp(spread / config.consistency.maxSpread, 0, 1)) * 10000) / 100;
  });
  return consistency;
}

// estimate(engineResult, config?) -> per-dimension {score, confidence, evidenceStrength,
// evidenceCoverage, contradictionPenalty, metadata}. `score` is added by ConfidenceReport.js,
// not here -- this module only computes the confidence-engine-derived fields.
function estimate(engineResult, config = defaultConfig) {
  const coverage = EvidenceCoverage.computeCoverage(engineResult, config);
  const consistency = computeConsistency(engineResult, config);
  const contradiction = ContradictionAnalyzer.analyze(engineResult, config);

  const out = {};
  engine.DIMS.forEach(k => {
    const signals = {
      coverage: coverage[k],
      consistency: consistency[k],
      contradictions: contradiction.perDimension[k],
    };
    const confidence = Math.round(EvidenceStrength.compositeOf(signals, config) * 100) / 100;
    const evidenceStrength = EvidenceStrength.strengthOf(signals, config);

    out[k] = {
      confidence,
      evidenceStrength,
      evidenceCoverage: coverage[k],
      contradictionPenalty: contradiction.perDimension[k],
      metadata: {
        coverageLayers: coverage.metadata[k].layers,
        consistency: consistency[k],
        conflicts: contradiction.conflicts.filter(c => Object.keys(c.dimensions).includes(k) && c.dimensions[k] >= config.contradiction.flagThreshold),
      },
    };
  });
  return out;
}

module.exports = { estimate, computeConsistency };
