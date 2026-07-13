// core-engine.js — pure scoring logic, no DOM. Mirrors BAF_Simulator_v4/v5 exactly.
// Used by the regression test harness to verify math independent of the UI.

const DIMS = ['RT','SC','ER','AR','DS','SR'];
const zeroVec = () => ({RT:0,SC:0,ER:0,AR:0,DS:0,SR:0});
const scaleVec = (v,s) => { const o={}; DIMS.forEach(k=>o[k]=(v[k]||0)*s); return o; };
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

// Layer weights (must sum to 1.00 — checked in tests). Left exactly as documented in
// Architecture doc Section 3.2b — unchanged by Tier S below. This is also the object
// the admin weight-publish endpoint (POST /v1/weights) versions and validates against;
// Tier S is deliberately NOT part of that versioned config yet (see SUBACUTE_WEIGHT).
const LAYER_WEIGHTS = {
  geo: 0.10, bio: 0.08, family: 0.18, culture: 0.12,
  social: 0.12, econ: 0.14, cognitive: 0.11, modulator: 0.15,
};

// Tier S (Subacute) — v6.2, per Architecture doc Section 3.2b.2's proposed 4th scoring
// tier: inputs that resolve in weeks-months (grief, major life transitions), too slow for
// the Modulator (re-assessed every run) but too transient to treat as structural (fixed
// for the session). Modeled as a *reserved slice*: when Tier S has at least one answered
// sub-layer, the 8 layers above are proportionally shrunk by (1 - SUBACUTE_WEIGHT) so
// Tier S carries its full, undiluted weight rather than diluting/being diluted inside a
// shared re-normalization pool; LAYER_WEIGHTS itself is never mutated, so this shrink is
// applied at compute time in computeEngine(), not baked into the exported constant. When
// Tier S has no answered subs, the shrink factor is exactly 1 — the 8 layers reproduce
// their pre-Tier-S proportions exactly, satisfying "falls back to current 8-layer-only
// weighting" as an identity, not an approximation.
//
// 0.06 proposed: smaller than every existing layer weight (min is bio at 0.08), because
// Tier S currently holds only 2 sub-layers (fewest of any layer — bio has 6) and the doc
// itself frames this as a stopgap pending a "real" v7 design, not an established domain
// on par with the other 8. Consistent with this project's pattern of erring conservative
// on new/contested additions (see nutrition/temperament confidence-correction, 3.2b.4).
const SUBACUTE_WEIGHT = 0.06;

// Expiry: 35 days (5 weeks) — the midpoint of the doc's stated 4-6 week re-prompt window
// (3.2b.2). Erring toward the middle rather than either edge: 4 weeks risks re-prompting
// testers about a life transition or grief process that hasn't meaningfully moved yet;
// 6 weeks risks a stale answer silently influencing a score for an extra 2+ weeks after
// it's plausibly out of date. Staleness is informational only (see subacuteStale below) —
// it does not exclude the sub-layer's contribution to finalVec, mirroring how the existing
// "Partial — low confidence" completeness flag is a label, not a scoring exclusion.
const SUBACUTE_EXPIRY_DAYS = 35;

// sub -> layer map, and sub -> micro count (for completeness math)
// v6.1: +24 sub-layers filling "Not yet implemented" rows from Architecture doc
// Section 3.2b.1 (8-domain evidence catalogue). Each new id's weight ceiling (enforced
// in BAF_Simulator_v6.html's micro vectors, checked by tests/test-cases.js) follows
// Section 3.2b.4's confidence-multiplier formula where a citation was independently
// fact-checked, otherwise the plain 3.2b.1 tier mapping. Domain 6 rows flagged as
// protected attributes (cultural identity/ethnicity, gender identity) are deliberately
// excluded per Section 6 guardrails and do not appear here.
const SUB_TO_LAYER = {
  terrain:'geo', climate:'geo', density:'geo',
  energy:'bio', health:'bio', age:'bio', nutrition:'bio', temperament:'bio',
  cognitive_style:'bio',
  parenting:'family', birthorder:'family', stability:'family',
  attachment_style:'family', past_failures:'family',
  // v6.3: Childhood adversity/trauma (ACEs, Felitti et al. 1998) -- HIGH tier ceiling
  // 1.50, confidence-CONFIRMED (not reduced) per 3.2b.4: independently verified as "one
  // of the best-replicated effects in the whole catalogue," stronger than the paper's own
  // citation implies. Overlaps 'stability' -- same double-counting caution as attachment_style.
  ace:'family',
  collectivism:'culture', tradition:'culture',
  density_net:'social', digital_ratio:'social',
  social_comparison:'social', relationship_conflict:'social', social_exclusion:'social',
  // v6.5: loneliness/social isolation (Cacioppo & Patrick 2008) -- closes the one clean
  // gap identified in the v6.5 catalogue audit (Architecture 3.2b.1 Domain 2). Ceiling
  // 1.25, no confidence-multiplier adjustment (large physiological evidence base, no
  // single quantifiable behavioral effect size -- same category as cognitive_style).
  loneliness:'social',
  current_stability:'econ', formative_scarcity:'econ',
  time_pressure:'econ',
  education:'cognitive', schema_flex:'cognitive',
  cognitive_overload:'cognitive', decision_fatigue:'cognitive', anchoring_framing:'cognitive',
  sunk_cost:'cognitive', availability_heuristic:'cognitive', info_overload:'cognitive',
  ego:'modulator', stress:'modulator', sleep:'modulator',
  dehydration:'modulator', hormonal:'modulator', substance_state:'modulator',
  depression:'modulator', fear_failure:'modulator',
  emotional_trauma:'modulator', anger_resentment:'modulator', shame:'modulator',
  core_values:'modulator',
  // v6.2: Tier S (Subacute) — migrated out of modulator/econ, see SUBACUTE_WEIGHT above.
  // Vectors and weight ceilings unchanged from v6.1; only the owning layer moved.
  grief:'subacute', life_transitions:'subacute',
};
const ALL_SUB_IDS = Object.keys(SUB_TO_LAYER);
const LAYER_SUB_COUNT = {};
ALL_SUB_IDS.forEach(id => { const l = SUB_TO_LAYER[id]; LAYER_SUB_COUNT[l] = (LAYER_SUB_COUNT[l]||0)+1; });
// Layer ids for roll-up purposes = the 8 documented layers + Tier S. 'subacute' is
// deliberately absent from LAYER_WEIGHTS (see SUBACUTE_WEIGHT comment above).
const ALL_LAYER_IDS = [...Object.keys(LAYER_WEIGHTS), 'subacute'];

// subScore: given a precision vector (exact, all 6 dims) OR a set of micro vectors, average them.
// For the regression harness we test two input shapes:
//   1. precisionVectors: { subId: {RT,SC,ER,AR,DS,SR} }  -- exact override, full precision
//   2. microVectors:     { subId: [vec1, vec2, ...] }     -- list of already-resolved micro vectors to average
function subScoreFrom(precisionVectors, microVectors, subId){
  const pv = precisionVectors[subId];
  if(pv && DIMS.every(k=> pv[k]!==undefined && pv[k]!=='' && !isNaN(pv[k]))){
    const out={}; DIMS.forEach(k=>out[k]=clamp(Number(pv[k]), -2, 2));
    return out;
  }
  const mv = microVectors[subId];
  if(!mv || mv.length===0) return null;
  const sum = zeroVec();
  mv.forEach(v => DIMS.forEach(k=> sum[k]+=v[k]));
  const out={}; DIMS.forEach(k=> out[k]=sum[k]/mv.length);
  return out;
}

// Full engine: rolls sub -> layer -> final, with live weight re-normalization.
// subacuteTimestamps: { subId: isoString } -- optional answer timestamp for Tier S subs
// only (grief, life_transitions). A sub with no timestamp is treated as freshly answered
// (not stale) -- matches a client answering it right now without bothering to timestamp.
function computeEngine({precisionVectors={}, microVectors={}, subacuteTimestamps={}}={}){
  const subScores = {};
  ALL_SUB_IDS.forEach(id => { subScores[id] = subScoreFrom(precisionVectors, microVectors, id); });

  const layerVecs = {};
  const layerAnsweredSubs = {};
  ALL_LAYER_IDS.forEach(layerId=>{
    const subIds = ALL_SUB_IDS.filter(id=>SUB_TO_LAYER[id]===layerId);
    const answered = subIds.map(id=>subScores[id]).filter(v=>v!==null);
    layerAnsweredSubs[layerId] = answered.length;
    if(answered.length===0){ layerVecs[layerId] = null; return; }
    const sum = zeroVec();
    answered.forEach(v=> DIMS.forEach(k=> sum[k]+=v[k]));
    const out={}; DIMS.forEach(k=> out[k]=sum[k]/answered.length);
    layerVecs[layerId] = out;
  });

  // Reserved-slice shrink: only applied when Tier S actually has an answered sub-layer.
  // Otherwise shrink=1 and effectiveWeights[l]===LAYER_WEIGHTS[l] exactly (identity).
  const subacuteAnswered = layerVecs.subacute !== null;
  const shrink = subacuteAnswered ? (1 - SUBACUTE_WEIGHT) : 1;
  const effectiveWeights = {};
  Object.keys(LAYER_WEIGHTS).forEach(l => { effectiveWeights[l] = LAYER_WEIGHTS[l] * shrink; });
  if (subacuteAnswered) effectiveWeights.subacute = SUBACUTE_WEIGHT;

  const answeredLayers = ALL_LAYER_IDS.filter(l=>layerVecs[l]!==null);
  const weightSum = answeredLayers.reduce((a,l)=>a+effectiveWeights[l],0) || 1;
  const finalVec = zeroVec();
  answeredLayers.forEach(l=>{
    const normW = effectiveWeights[l]/weightSum;
    DIMS.forEach(k=> finalVec[k]+= normW*layerVecs[l][k]);
  });

  const answeredSubsTotal = Object.values(layerAnsweredSubs).reduce((a,b)=>a+b,0);

  // Tier S expiry (informational only -- does not affect finalVec above).
  const subacuteSubIds = ALL_SUB_IDS.filter(id=>SUB_TO_LAYER[id]==='subacute');
  const staleSubacuteSubs = subacuteSubIds.filter(id=>{
    if(subScores[id]===null) return false; // unanswered -> not stale
    const ts = subacuteTimestamps[id];
    if(!ts) return false; // no timestamp provided -> treat as freshly answered
    const ageMs = Date.now() - new Date(ts).getTime();
    return ageMs > SUBACUTE_EXPIRY_DAYS*24*60*60*1000;
  });

  return {
    subScores, layerVecs, layerAnsweredSubs,
    finalVec,
    completeness: answeredSubsTotal / ALL_SUB_IDS.length,
    answeredSubsTotal, totalSubs: ALL_SUB_IDS.length,
    answeredLayers: answeredLayers.length, totalLayers: ALL_LAYER_IDS.length,
    subacuteStale: staleSubacuteSubs.length > 0,
    staleSubacuteSubs,
  };
}

module.exports = {
  DIMS, zeroVec, scaleVec, LAYER_WEIGHTS, SUB_TO_LAYER, ALL_SUB_IDS, ALL_LAYER_IDS,
  LAYER_SUB_COUNT, SUBACUTE_WEIGHT, SUBACUTE_EXPIRY_DAYS, subScoreFrom, computeEngine,
};
