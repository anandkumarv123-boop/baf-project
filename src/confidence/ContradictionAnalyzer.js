// src/confidence/ContradictionAnalyzer.js — dampener-aware internal contradiction signal.
//
// Reads CORRELATED_PAIRS (['attachment_style','parenting'], same-layer) and
// CROSS_LAYER_PAIRS (['emotional_trauma','stability'], cross-layer) directly from
// src/core-engine.js -- real exported constants the engine itself already uses to *dampen*
// these pairs' influence on finalVec (see core-engine.js:94-200). This module does NOT
// duplicate that dampening; it measures a different thing: how much the two members of a
// pair the catalogue author already flagged as "knowingly overlapping" actually *disagree*
// in their raw, pre-dampener answers (engineResult.subScores). Two subs the engine treats as
// measuring highly overlapping constructs disagreeing sharply is itself evidence worth
// surfacing -- either the respondent's answers are internally inconsistent, or the
// overlap assumption doesn't hold for this particular profile.
//
// Divergence outside these specific pairs is deliberately NOT measured here (per spec:
// "divergence within unrelated pairs -> normal, no flag") -- this is a narrow, dampener-aware
// signal, not a general anomaly detector. That is a distinct, complementary signal from
// scripts/consistency-check.js's checkConsistency(), which compares an already-computed
// finalVec against EXTERNAL scenario-bank answers -- no data source or computation overlaps
// between the two.

const engine = require('../core-engine');
const defaultConfig = require('../../config/confidenceConfig');

const ALL_PAIRS = [
  ...engine.CORRELATED_PAIRS.map(pair => ({ pair, kind: 'same-layer' })),
  ...engine.CROSS_LAYER_PAIRS.map(pair => ({ pair, kind: 'cross-layer' })),
];

// analyze(engineResult, config?) -> { perDimension: {RT:0-100,...}, conflicts: [...], affectedLayers: [...] }
function analyze(engineResult, config = defaultConfig) {
  const perDimension = {};
  engine.DIMS.forEach(k => { perDimension[k] = 0; });

  const conflicts = [];
  const affectedLayersSet = new Set();

  ALL_PAIRS.forEach(({ pair, kind }) => {
    const [a, b] = pair;
    const vecA = engineResult.subScores[a];
    const vecB = engineResult.subScores[b];
    if (vecA === null || vecB === null) return; // needs both answered, same guarantee as the dampeners themselves

    const divergence = {};
    let maxDivergence = 0;
    let maxDim = null;
    engine.DIMS.forEach(k => {
      // 4 = max possible |delta| between two values each clamped to the engine's -2..2 range.
      const d = (Math.abs(vecA[k] - vecB[k]) / 4) * 100;
      divergence[k] = d;
      if (d > perDimension[k]) perDimension[k] = d; // perDimension = max divergence across any pair touching k
      if (d > maxDivergence) { maxDivergence = d; maxDim = k; }
    });

    const layers = [...new Set([engine.SUB_TO_LAYER[a], engine.SUB_TO_LAYER[b]])];
    layers.forEach(l => affectedLayersSet.add(l));

    if (maxDivergence >= config.contradiction.flagThreshold) {
      conflicts.push({ pairIds: pair, kind, layers, dimensions: divergence, maxDivergence, maxDim });
    }
  });

  engine.DIMS.forEach(k => { perDimension[k] = Math.round(perDimension[k] * 100) / 100; });

  return { perDimension, conflicts, affectedLayers: [...affectedLayersSet] };
}

module.exports = { analyze, ALL_PAIRS };
