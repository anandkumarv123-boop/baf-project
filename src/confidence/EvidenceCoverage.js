// src/confidence/EvidenceCoverage.js — per-dimension evidence coverage, 0-100.
//
// Why per-dimension and not per-layer: a naive per-layer "answered fraction" number would be
// identical across all 6 dimensions, because every answered sub-layer contributes a full
// 6-dim vector (precisionVectors/microVectors have no way to answer "only RT"). That would
// make evidenceCoverage a repeated constant, not a real per-dimension signal. Instead, this
// differentiates *which dimensions a layer's answered subs actually carry non-negligible
// signal on*, using the same "non-negligible" convention as scripts/consistency-check.js's
// NEUTRAL_EPSILON (0.05 on the engine's -2..2 scale) -- restated as config.neutralEpsilon
// (see config/confidenceConfig.js's header comment for why it's a separate mutable copy).
//
// Aggregation across layers uses core-engine.js's own effectiveWeights formula
// (core-engine.js:250-263: LAYER_WEIGHTS[l] * shrink, where shrink = 1-SUBACUTE_WEIGHT only
// when Tier S is answered, else 1; effectiveWeights sums to exactly 1.0 across ALL_LAYER_IDS
// by construction) -- the same reconstruction sensitivity-analysis.js/ablate-layer-weights.js
// already use. Deliberately NOT renormalized down to only the answered layers (that
// renormalization is correct for finalVec's blend, but wrong here: it would make a profile
// that fully answers one small layer and nothing else show 100% coverage, which defeats the
// point of a coverage signal -- an unanswered layer must keep dragging coverage down by its
// full declared weight, not vanish from the denominator). Reads only real exported constants
// (LAYER_WEIGHTS, SUBACUTE_WEIGHT, ALL_LAYER_IDS, ALL_SUB_IDS, SUB_TO_LAYER); no scoring math
// from computeEngine() is reimplemented.

const engine = require('../core-engine');
const defaultConfig = require('../../config/confidenceConfig');

function subIdsForLayer(layerId) {
  return engine.ALL_SUB_IDS.filter(id => engine.SUB_TO_LAYER[id] === layerId);
}

// effectiveWeights(engineResult) -> { geo: w, ..., subacute?: w }, summing to 1.0 over
// ALL_LAYER_IDS. Mirrors core-engine.js:250-256 exactly, without the answered-only
// renormalization step that follows it there (see file header for why).
function effectiveWeights(engineResult) {
  const subacuteAnswered = engineResult.layerVecs.subacute !== null;
  const shrink = subacuteAnswered ? (1 - engine.SUBACUTE_WEIGHT) : 1;
  const weights = {};
  Object.keys(engine.LAYER_WEIGHTS).forEach(l => { weights[l] = engine.LAYER_WEIGHTS[l] * shrink; });
  weights.subacute = subacuteAnswered ? engine.SUBACUTE_WEIGHT : 0;
  return weights;
}

// computeCoverage(engineResult, config?) -> { RT: 0-100, ..., metadata }
function computeCoverage(engineResult, config = defaultConfig) {
  const epsilon = config.neutralEpsilon;
  const weights = effectiveWeights(engineResult);

  const coverage = {};
  const metadata = {};
  engine.DIMS.forEach(k => { coverage[k] = 0; metadata[k] = { layers: [] }; });

  engine.ALL_LAYER_IDS.forEach(layerId => {
    const subIds = subIdsForLayer(layerId);
    if (subIds.length === 0 || weights[layerId] === 0) return;

    engine.DIMS.forEach(k => {
      const touching = subIds.filter(id => {
        const v = engineResult.subScores[id];
        return v !== null && Math.abs(v[k]) > epsilon;
      });
      const touchFraction = touching.length / subIds.length;
      coverage[k] += weights[layerId] * touchFraction;
      if (touching.length > 0) {
        metadata[k].layers.push({ layer: layerId, touchingSubs: touching, touchFraction });
      }
    });
  });

  engine.DIMS.forEach(k => { coverage[k] = Math.round(coverage[k] * 10000) / 100; }); // 0-100, 2dp

  return { ...coverage, metadata };
}

module.exports = { computeCoverage, effectiveWeights, subIdsForLayer };
