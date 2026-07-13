const { computeEngine, LAYER_WEIGHTS, ALL_SUB_IDS, SUBACUTE_WEIGHT, SUBACUTE_EXPIRY_DAYS } = require('./core-engine');

const TOTAL = ALL_SUB_IDS.length; // now 47 as of v6.3 (was 46 pre-v6.3, 22 pre-v6.1, 20 pre-v6)
const TOL = 0.001;
const results = [];

function approxEqual(a,b,tol=TOL){ return Math.abs(a-b) <= tol; }

function check(name, actual, expected, meta){
  let pass = true;
  const diffs = [];
  Object.keys(expected).forEach(k=>{
    if(!approxEqual(actual[k], expected[k])){
      pass = false;
      diffs.push(`${k}: expected ${expected[k]}, got ${actual[k]}`);
    }
  });
  results.push({name, pass, diffs, meta});
}

// TC1 — empty input: nothing answered anywhere
{
  const r = computeEngine({});
  check('TC1 empty input -> zero vector, 0% complete', r.finalVec, {RT:0,SC:0,ER:0,AR:0,DS:0,SR:0});
  check('TC1b completeness', {c:r.completeness}, {c:0});
}

// TC2 — single sub-layer (geo/terrain) exact precision vector, nothing else answered
{
  const r = computeEngine({precisionVectors:{ terrain:{RT:2,SC:1,ER:1,AR:-1,DS:0,SR:1} }});
  check('TC2 single sub (terrain) -> passthrough (only geo layer live, weight renorm=1.0)', r.finalVec, {RT:2,SC:1,ER:1,AR:-1,DS:0,SR:1});
  check('TC2b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC3 — all 3 subs of family layer identical vector -> layer avg = same vector, only layer live
{
  const v = {RT:1,SC:0,ER:0,AR:0,DS:0,SR:0};
  const r = computeEngine({precisionVectors:{ parenting:v, birthorder:v, stability:v }});
  check('TC3 family layer fully filled, identical vectors -> passthrough', r.finalVec, v);
  check('TC3b completeness = 3/T', {c:r.completeness}, {c:3/TOTAL});
}

// TC4 — two layers (geo weight .10, bio weight .08) opposite vectors -> verify renormalized weighted blend
{
  const vA = {RT:2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const vB = {RT:-2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const r = computeEngine({precisionVectors:{
    terrain:vA, climate:vA, density:vA,
    energy:vB, health:vB, age:vB,
  }});
  const expectedRT = (0.10/0.18)*2 + (0.08/0.18)*(-2); // = 2/9 = 0.2222
  check('TC4 renormalized 2-layer blend (geo .10 vs bio .08)', r.finalVec, {RT:expectedRT, SC:0,ER:0,AR:0,DS:0,SR:0});
  check('TC4b completeness = 6/T', {c:r.completeness}, {c:6/TOTAL});
}

// TC5 — every sub-layer answered with zero vector -> final zero, 100% complete
{
  const pv = {};
  require('./core-engine').ALL_SUB_IDS.forEach(id=> pv[id]={RT:0,SC:0,ER:0,AR:0,DS:0,SR:0});
  const r = computeEngine({precisionVectors:pv});
  check('TC5 all-zero full run -> zero vector, 100% complete', r.finalVec, {RT:0,SC:0,ER:0,AR:0,DS:0,SR:0});
  check('TC5b completeness = 1.0', {c:r.completeness}, {c:1.0});
}

// TC6 — every sub-layer at max (+2 all dims) -> weighted avg of identical vectors = same vector exactly
{
  const pv = {};
  require('./core-engine').ALL_SUB_IDS.forEach(id=> pv[id]={RT:2,SC:2,ER:2,AR:2,DS:2,SR:2});
  const r = computeEngine({precisionVectors:pv});
  check('TC6 all-max full run -> max vector preserved exactly', r.finalVec, {RT:2,SC:2,ER:2,AR:2,DS:2,SR:2});
}

// TC7 — single sub answered inside modulator (highest-weight layer), verify passthrough regardless of weight size
{
  const r = computeEngine({precisionVectors:{ ego:{RT:-2,SC:0,ER:2,AR:1,DS:-2,SR:-2} }});
  check('TC7 single sub in modulator layer -> passthrough', r.finalVec, {RT:-2,SC:0,ER:2,AR:1,DS:-2,SR:-2});
  check('TC7b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC8 — micro-vector averaging path (non-precision): sleep sub gets 2 micro vectors averaged
{
  const r = computeEngine({microVectors:{ sleep: [
    {RT:0,SC:0,ER:-1,AR:0,DS:0,SR:1},
    {RT:0,SC:0,ER:1.5,AR:0,DS:0,SR:-1},
  ]}});
  check('TC8 micro-averaging (sleep: 2 items) -> mean vector', r.finalVec, {RT:0,SC:0,ER:0.25,AR:0,DS:0,SR:0});
}

// TC9 — config integrity: layer weights must sum to 1.00
{
  const sum = Object.values(LAYER_WEIGHTS).reduce((a,b)=>a+b,0);
  check('TC9 layer weights sum to 1.00 (config integrity)', {s:sum}, {s:1.00});
}

// TC10 — one sub per layer, all 8 layers touched -> weightSum=1 (no renorm), finalRT = sum of weights = 1.0
{
  const v = {RT:1,SC:0,ER:0,AR:0,DS:0,SR:0};
  const r = computeEngine({precisionVectors:{
    terrain:v, energy:v, parenting:v, collectivism:v,
    density_net:v, current_stability:v, education:v, ego:v,
  }});
  check('TC10 one sub per all 8 layers -> no renorm needed, finalRT=1.0', r.finalVec, {RT:1,SC:0,ER:0,AR:0,DS:0,SR:0});
  check('TC10b completeness = 8/T', {c:r.completeness}, {c:8/TOTAL});
}

// TC11 — out-of-range input clamps to [-2, 2]
{
  const r = computeEngine({precisionVectors:{ terrain:{RT:5,SC:-9,ER:0,AR:0,DS:0,SR:0} }});
  check('TC11 out-of-range input clamps to [-2,2]', r.finalVec, {RT:2,SC:-2,ER:0,AR:0,DS:0,SR:0});
}

// TC12 (v6) — nutrition sub-layer alone (bio layer), confidence-corrected ceiling 1.00
{
  const r = computeEngine({precisionVectors:{ nutrition:{RT:-0.7,SC:0.3,ER:0.7,AR:0.3,DS:-0.7,SR:-1.0} }});
  check('TC12 (v6) nutrition sub passthrough (only bio layer live)', r.finalVec, {RT:-0.7,SC:0.3,ER:0.7,AR:0.3,DS:-0.7,SR:-1.0});
  check('TC12b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC13 (v6) — temperament sub-layer alone (bio layer), confidence-corrected ceiling 1.25
{
  const r = computeEngine({precisionVectors:{ temperament:{RT:0.5,SC:-0.3,ER:-1.25,AR:-0.3,DS:0.5,SR:1.0} }});
  check('TC13 (v6) temperament sub passthrough (only bio layer live)', r.finalVec, {RT:0.5,SC:-0.3,ER:-1.25,AR:-0.3,DS:0.5,SR:1.0});
}

// TC14 (v6, generalized in v6.1) — magnitude-ceiling integrity, read LIVE from
// BAF_Simulator_v6.html (single source of truth, not a hand-duplicated copy) so this test
// fails automatically if the production file ever drifts from the confidence-corrected or
// tier-mapped weights documented in Architecture 3.2b.1 / 3.2b.4. Covers every sub-layer
// whose weight ceiling is below the engine's global +/-2 clamp, across all 8 layers —
// not just Biological Foundation, which is all the pre-v6.1 version checked.
const CEILINGS = {
  nutrition: 1.00, temperament: 1.25,                         // v6
  dehydration: 0.75, hormonal: 1.25, substance_state: 1.50,    // Domain 1
  depression: 1.50, grief: 1.25, fear_failure: 1.50,           // Domain 2
  emotional_trauma: 1.50, anger_resentment: 1.50, shame: 2.00, // Domain 2 cont.
  cognitive_overload: 1.50, decision_fatigue: 1.50,            // Domain 3
  anchoring_framing: 1.25, sunk_cost: 1.50,                    // Domain 3 cont.
  availability_heuristic: 1.25, info_overload: 1.50,           // Domain 3 cont.
  social_comparison: 1.25, relationship_conflict: 1.25,        // Domain 4
  social_exclusion: 1.50,                                      // Domain 4 cont.
  time_pressure: 1.50, life_transitions: 1.25,                 // Domain 5
  core_values: 1.50,                                           // Domain 6
  attachment_style: 1.50, past_failures: 1.50,                 // Domain 7
  cognitive_style: 1.50,                                       // Domain 8
  ace: 1.50,                                                   // Domain 7 (v6.3)
  loneliness: 1.25,                                            // Domain 2 (v6.5)
};
{
  const fs = require('fs');
  const path = require('path');
  const candidates = [
    path.join(__dirname, 'BAF_Simulator_v6.html'),
    path.join(__dirname, '..', 'BAF_Simulator_v6.html'),
  ];
  const htmlPath = candidates.find(p => fs.existsSync(p));
  let LAYERS = null, errMsg = null;
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    const snippet = script.slice(script.indexOf('const DIMS'), script.indexOf('const TOTAL_SUBS'));
    const tmp = path.join(require('os').tmpdir(), '_v6_layers_check.js');
    fs.writeFileSync(tmp, snippet + '\nmodule.exports = { LAYERS };');
    delete require.cache[require.resolve(tmp)];
    LAYERS = require(tmp).LAYERS;
  } catch (e) {
    errMsg = e.message;
  }

  const maxAbs = v => Math.max(...Object.values(v).map(Math.abs));
  const allSubs = {};
  if (LAYERS) LAYERS.forEach(l => l.subs.forEach(s => { allSubs[s.id] = s; }));

  Object.entries(CEILINGS).forEach(([subId, ceiling]) => {
    let pass = false, actualMax = null, diff = null;
    if (!LAYERS) {
      diff = errMsg || 'could not load BAF_Simulator_v6.html';
    } else {
      const sub = allSubs[subId];
      if (!sub) {
        diff = `sub-layer '${subId}' not found in BAF_Simulator_v6.html LAYERS`;
      } else {
        actualMax = 0;
        sub.micro.forEach(m => {
          if (m.type === 'select') m.options.forEach(o => actualMax = Math.max(actualMax, maxAbs(o.v)));
          else actualMax = Math.max(actualMax, maxAbs(m.v));
        });
        pass = actualMax <= ceiling + 0.0001;
        if (!pass) diff = `${subId}: expected ceiling <=${ceiling}, got max ${actualMax}`;
      }
    }
    results.push({
      name: `TC14.${subId} (v6.1) live production ceiling respected (<=${ceiling}${actualMax!==null?', got '+actualMax:''})`,
      pass,
      diffs: pass ? [] : [diff],
    });
  });
}

// TC15-38 (v6.1) — one passthrough test per new sub-layer added from Architecture doc
// Section 3.2b.1 (8-domain evidence catalogue). Each vector is the sub's "extreme" pick
// option as authored in BAF_Simulator_v6.html, so these tests double as a live cross-check
// that the two files haven't drifted apart. Every sub here is the sole answered sub-layer,
// so weight renormalizes to 1.0 and the final vector should exactly equal the input.

// TC15 — dehydration (modulator, ceiling 0.75)
{
  const r = computeEngine({precisionVectors:{ dehydration:{RT:-0.3,SC:0.1,ER:0.5,AR:0.2,DS:-0.5,SR:-0.75} }});
  check('TC15 (v6.1) dehydration sub passthrough', r.finalVec, {RT:-0.3,SC:0.1,ER:0.5,AR:0.2,DS:-0.5,SR:-0.75});
  check('TC15b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC16 — hormonal fluctuation (modulator, ceiling 1.25)
{
  const r = computeEngine({precisionVectors:{ hormonal:{RT:-0.4,SC:0.3,ER:1.25,AR:0.4,DS:-0.7,SR:-1.0} }});
  check('TC16 (v6.1) hormonal sub passthrough', r.finalVec, {RT:-0.4,SC:0.3,ER:1.25,AR:0.4,DS:-0.7,SR:-1.0});
}

// TC17 — alcohol / substance state (modulator, ceiling 1.50, acute tier)
{
  const r = computeEngine({precisionVectors:{ substance_state:{RT:1.5,SC:-0.7,ER:0.8,AR:-1.0,DS:-1.5,SR:-0.8} }});
  check('TC17 (v6.1) substance_state sub passthrough', r.finalVec, {RT:1.5,SC:-0.7,ER:0.8,AR:-1.0,DS:-1.5,SR:-0.8});
}

// TC18 — depression (modulator, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ depression:{RT:-1.0,SC:0.3,ER:0.8,AR:0.5,DS:-1.2,SR:-1.5} }});
  check('TC18 (v6.1) depression sub passthrough', r.finalVec, {RT:-1.0,SC:0.3,ER:0.8,AR:0.5,DS:-1.2,SR:-1.5});
}

// TC19 — grief and loss (v6.2: migrated modulator -> subacute/Tier S, ceiling 1.25 unchanged
// per 3.2b.2). Vector and expected result deliberately left byte-for-byte identical to the
// pre-Tier-S version: with grief as the sole answered sub-layer, weight-of-one renormalizes
// to 1.0 regardless of which layer (or Tier S) it belongs to or what that layer's weight is
// — so this passthrough is robust to the migration by construction. See TC39+ below for
// tests that actually exercise Tier S's reserved-slice weighting.
{
  const r = computeEngine({precisionVectors:{ grief:{RT:-0.7,SC:0.4,ER:1.25,AR:0.3,DS:-0.9,SR:-1.1} }});
  check('TC19 (v6.1) grief sub passthrough', r.finalVec, {RT:-0.7,SC:0.4,ER:1.25,AR:0.3,DS:-0.9,SR:-1.1});
}

// TC20 — fear of failure / rejection sensitivity (modulator, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ fear_failure:{RT:-1.5,SC:0.8,ER:1.2,AR:0.9,DS:-1.0,SR:-0.9} }});
  check('TC20 (v6.1) fear_failure sub passthrough', r.finalVec, {RT:-1.5,SC:0.8,ER:1.2,AR:0.9,DS:-1.0,SR:-0.9});
}

// TC21 — emotional trauma (modulator, ceiling 1.50, triggered tier; overlaps family 'stability')
{
  const r = computeEngine({precisionVectors:{ emotional_trauma:{RT:-0.6,SC:0.3,ER:1.5,AR:0.4,DS:-0.8,SR:-1.3} }});
  check('TC21 (v6.1) emotional_trauma sub passthrough', r.finalVec, {RT:-0.6,SC:0.3,ER:1.5,AR:0.4,DS:-0.8,SR:-1.3});
}

// TC22 — anger and stored resentment (modulator, ceiling 1.50, triggered tier)
{
  const r = computeEngine({precisionVectors:{ anger_resentment:{RT:0.6,SC:-0.3,ER:1.5,AR:-0.6,DS:-0.5,SR:-1.2} }});
  check('TC22 (v6.1) anger_resentment sub passthrough', r.finalVec, {RT:0.6,SC:-0.3,ER:1.5,AR:-0.6,DS:-0.5,SR:-1.2});
}

// TC23 — shame (modulator, ceiling 2.00, highest untapped weight in the catalogue)
{
  const r = computeEngine({precisionVectors:{ shame:{RT:-1.2,SC:1.2,ER:2.0,AR:1.0,DS:-1.5,SR:-2.0} }});
  check('TC23 (v6.1) shame sub passthrough', r.finalVec, {RT:-1.2,SC:1.2,ER:2.0,AR:1.0,DS:-1.5,SR:-2.0});
  check('TC23b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC24 — cognitive overload (cognitive, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ cognitive_overload:{RT:-0.8,SC:0.4,ER:1.2,AR:0.6,DS:-1.5,SR:-1.0} }});
  check('TC24 (v6.1) cognitive_overload sub passthrough', r.finalVec, {RT:-0.8,SC:0.4,ER:1.2,AR:0.6,DS:-1.5,SR:-1.0});
}

// TC25 — decision fatigue (cognitive, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ decision_fatigue:{RT:-0.5,SC:0.6,ER:0.7,AR:0.9,DS:-1.5,SR:-0.8} }});
  check('TC25 (v6.1) decision_fatigue sub passthrough', r.finalVec, {RT:-0.5,SC:0.6,ER:0.7,AR:0.9,DS:-1.5,SR:-0.8});
}

// TC26 — anchoring and framing effects (cognitive, ceiling 1.25)
{
  const r = computeEngine({precisionVectors:{ anchoring_framing:{RT:-0.5,SC:0.6,ER:0.4,AR:0.8,DS:-1.25,SR:-0.3} }});
  check('TC26 (v6.1) anchoring_framing sub passthrough', r.finalVec, {RT:-0.5,SC:0.6,ER:0.4,AR:0.8,DS:-1.25,SR:-0.3});
}

// TC27 — sunk cost fallacy (cognitive, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ sunk_cost:{RT:-0.8,SC:0.5,ER:0.6,AR:0.6,DS:-1.5,SR:-0.6} }});
  check('TC27 (v6.1) sunk_cost sub passthrough', r.finalVec, {RT:-0.8,SC:0.5,ER:0.6,AR:0.6,DS:-1.5,SR:-0.6});
}

// TC28 — availability heuristic (cognitive, ceiling 1.25)
{
  const r = computeEngine({precisionVectors:{ availability_heuristic:{RT:-0.5,SC:0.4,ER:0.5,AR:0.4,DS:-1.25,SR:-0.3} }});
  check('TC28 (v6.1) availability_heuristic sub passthrough', r.finalVec, {RT:-0.5,SC:0.4,ER:0.5,AR:0.4,DS:-1.25,SR:-0.3});
}

// TC29 — information overload / analysis paralysis (cognitive, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ info_overload:{RT:-0.7,SC:0.4,ER:0.7,AR:0.5,DS:-1.5,SR:-0.6} }});
  check('TC29 (v6.1) info_overload sub passthrough', r.finalVec, {RT:-0.7,SC:0.4,ER:0.7,AR:0.5,DS:-1.5,SR:-0.6});
}

// TC30 — social comparison / competitive pressure (social, ceiling 1.25)
{
  const r = computeEngine({precisionVectors:{ social_comparison:{RT:-0.3,SC:1.0,ER:0.8,AR:0.5,DS:-0.6,SR:-1.0} }});
  check('TC30 (v6.1) social_comparison sub passthrough', r.finalVec, {RT:-0.3,SC:1.0,ER:0.8,AR:0.5,DS:-0.6,SR:-1.0});
}

// TC31 — relationship conflict (social, ceiling 1.25)
{
  const r = computeEngine({precisionVectors:{ relationship_conflict:{RT:-0.5,SC:0.5,ER:1.25,AR:0.5,DS:-0.6,SR:-1.1} }});
  check('TC31 (v6.1) relationship_conflict sub passthrough', r.finalVec, {RT:-0.5,SC:0.5,ER:1.25,AR:0.5,DS:-0.6,SR:-1.1});
}

// TC32 — social exclusion / rejection (social, ceiling 1.50, fact-checked confirmed 1.00x)
{
  const r = computeEngine({precisionVectors:{ social_exclusion:{RT:-0.5,SC:0.6,ER:1.5,AR:0.5,DS:-0.7,SR:-1.3} }});
  check('TC32 (v6.1) social_exclusion sub passthrough', r.finalVec, {RT:-0.5,SC:0.6,ER:1.5,AR:0.5,DS:-0.7,SR:-1.3});
}

// TC33 — time pressure (econ, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ time_pressure:{RT:0.8,SC:0.4,ER:1.5,AR:0.6,DS:-1.2,SR:-1.3} }});
  check('TC33 (v6.1) time_pressure sub passthrough', r.finalVec, {RT:0.8,SC:0.4,ER:1.5,AR:0.6,DS:-1.2,SR:-1.3});
}

// TC34 — major life transitions (v6.2: migrated econ -> subacute/Tier S, ceiling 1.25
// unchanged per 3.2b.2). Same robustness-by-construction note as TC19 above.
{
  const r = computeEngine({precisionVectors:{ life_transitions:{RT:0.6,SC:0.4,ER:1.25,AR:0.4,DS:-0.7,SR:-1.1} }});
  check('TC34 (v6.1) life_transitions sub passthrough', r.finalVec, {RT:0.6,SC:0.4,ER:1.25,AR:0.4,DS:-0.7,SR:-1.1});
}

// TC35 — core values / moral identity (modulator, ceiling 1.50, not a protected attribute)
{
  const r = computeEngine({precisionVectors:{ core_values:{RT:-0.4,SC:0.7,ER:0.9,AR:0.7,DS:-1.2,SR:-1.5} }});
  check('TC35 (v6.1) core_values sub passthrough', r.finalVec, {RT:-0.4,SC:0.7,ER:0.9,AR:0.7,DS:-1.2,SR:-1.5});
}

// TC36 — childhood attachment style (family, ceiling 1.50, split out from 'parenting')
{
  const r = computeEngine({precisionVectors:{ attachment_style:{RT:-0.5,SC:0.8,ER:1.3,AR:0.5,DS:-0.9,SR:-1.2} }});
  check('TC36 (v6.1) attachment_style sub passthrough', r.finalVec, {RT:-0.5,SC:0.8,ER:1.3,AR:0.5,DS:-0.9,SR:-1.2});
}

// TC37 — significant past failures and successes (family, ceiling 1.50)
{
  const r = computeEngine({precisionVectors:{ past_failures:{RT:-0.6,SC:0.4,ER:0.8,AR:0.4,DS:-0.9,SR:-1.5} }});
  check('TC37 (v6.1) past_failures sub passthrough', r.finalVec, {RT:-0.6,SC:0.4,ER:0.8,AR:0.4,DS:-0.9,SR:-1.5});
}

// TC38 — cognitive style, analytical vs. intuitive (bio, ceiling 1.50, maps directly to DS)
{
  const r = computeEngine({precisionVectors:{ cognitive_style:{RT:0.5,SC:0.2,ER:0.3,AR:0.1,DS:-1.5,SR:-0.2} }});
  check('TC38 (v6.1) cognitive_style sub passthrough', r.finalVec, {RT:0.5,SC:0.2,ER:0.3,AR:0.1,DS:-1.5,SR:-0.2});
  check('TC38b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC39-47 (v6.2) — Tier S (Subacute): re-normalization math, expiry flagging, and a
// live cross-check that BAF_Simulator_v6.html's mirror hasn't drifted. See Architecture
// doc Section 3.2b.2 and src/core-engine.js's SUBACUTE_WEIGHT/SUBACUTE_EXPIRY_DAYS comments
// for the full design reasoning (reserved-slice weighting, 35-day expiry).

// TC39 — Tier S unanswered -> exact fallback to pre-Tier-S 8-layer weighting (identity,
// not an approximation). Re-runs TC4's 2-layer blend; result must be bit-for-bit the same
// as before Tier S existed, since the shrink factor is exactly 1 when subacute is unanswered.
{
  const vA = {RT:2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const vB = {RT:-2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const r = computeEngine({precisionVectors:{
    terrain:vA, climate:vA, density:vA,
    energy:vB, health:vB, age:vB,
  }});
  const expectedRT = (0.10/0.18)*2 + (0.08/0.18)*(-2); // unchanged from TC4
  check('TC39 (v6.2) Tier S unanswered -> exact 8-layer fallback', r.finalVec, {RT:expectedRT, SC:0,ER:0,AR:0,DS:0,SR:0});
}

// TC40 — Tier S answered alongside a PARTIAL subset of the 8 (geo fully answered, bio
// partially answered via 3 of its 6 subs) -> reserved-slice math: the 8 are shrunk by
// (1-SUBACUTE_WEIGHT), subacute keeps its full undiluted SUBACUTE_WEIGHT. Hand-computed
// expected value (see PR discussion): weightSum = 0.10*0.94 + 0.08*0.94 + 0.06 = 0.2292.
{
  const vA = {RT:2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const vB = {RT:-2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const vC = {RT:2,SC:0,ER:0,AR:0,DS:0,SR:0};
  const r = computeEngine({precisionVectors:{
    terrain:vA, climate:vA, density:vA,
    energy:vB, health:vB, age:vB,
    grief:vC,
  }});
  const shrink = 1 - SUBACUTE_WEIGHT;
  const wGeo = LAYER_WEIGHTS.geo*shrink, wBio = LAYER_WEIGHTS.bio*shrink, wSub = SUBACUTE_WEIGHT;
  const weightSum = wGeo + wBio + wSub;
  const expectedRT = (wGeo*2 + wBio*(-2) + wSub*2) / weightSum;
  check('TC40 (v6.2) Tier S + partial 8-layer completion -> reserved-slice blend', r.finalVec, {RT:expectedRT, SC:0,ER:0,AR:0,DS:0,SR:0});
}

// TC41 — Tier S answered alongside ALL 8 layers fully answered -> subacute's effective
// weight is exactly SUBACUTE_WEIGHT (undiluted), not diluted by competing in a shared pool.
{
  const v = {RT:1,SC:0,ER:0,AR:0,DS:0,SR:0};
  const r = computeEngine({precisionVectors:{
    terrain:v, energy:v, parenting:v, collectivism:v,
    density_net:v, current_stability:v, education:v, ego:v,
    grief:v,
  }});
  check('TC41 (v6.2) Tier S + full 8-layer completion -> finalRT=1.0 (weight-of-9, still renorms to 1)', r.finalVec, {RT:1, SC:0,ER:0,AR:0,DS:0,SR:0});
  check('TC41b completeness = 9/T', {c:r.completeness}, {c:9/TOTAL});
}

// TC42 — Tier S answered, no timestamp provided -> treated as freshly answered, not stale.
{
  const r = computeEngine({precisionVectors:{ grief:{RT:1,SC:0,ER:0,AR:0,DS:0,SR:0} }});
  check('TC42 (v6.2) Tier S no timestamp -> not stale', {s:r.subacuteStale}, {s:false});
}

// TC43 — Tier S answered with a fresh (just-now) timestamp -> not stale.
{
  const r = computeEngine({precisionVectors:{ grief:{RT:1,SC:0,ER:0,AR:0,DS:0,SR:0} }, subacuteTimestamps:{ grief:new Date().toISOString() }});
  check('TC43 (v6.2) Tier S fresh timestamp -> not stale', {s:r.subacuteStale}, {s:false});
}

// TC44 — Tier S answered with a timestamp older than SUBACUTE_EXPIRY_DAYS -> stale, and
// the specific stale sub-layer id is reported.
{
  const oldTs = new Date(Date.now() - (SUBACUTE_EXPIRY_DAYS+5)*24*60*60*1000).toISOString();
  const r = computeEngine({precisionVectors:{ grief:{RT:1,SC:0,ER:0,AR:0,DS:0,SR:0} }, subacuteTimestamps:{ grief:oldTs }});
  check('TC44 (v6.2) Tier S timestamp past expiry -> stale', {s:r.subacuteStale}, {s:true});
  results.push({ name: 'TC44b staleSubacuteSubs reports the right id', pass: JSON.stringify(r.staleSubacuteSubs)==='["grief"]', diffs: JSON.stringify(r.staleSubacuteSubs)==='["grief"]'?[]:[`got ${JSON.stringify(r.staleSubacuteSubs)}`] });
}

// TC45 — staleness is informational only: an identical vector produces an identical
// finalVec whether flagged stale or not (the flag never touches score math).
{
  const vec = {RT:1,SC:0,ER:0,AR:0,DS:0,SR:0};
  const oldTs = new Date(Date.now() - (SUBACUTE_EXPIRY_DAYS+5)*24*60*60*1000).toISOString();
  const rFresh = computeEngine({precisionVectors:{ grief:vec }});
  const rStale = computeEngine({precisionVectors:{ grief:vec }, subacuteTimestamps:{ grief:oldTs }});
  results.push({
    name: 'TC45 (v6.2) stale flag does not alter finalVec',
    pass: JSON.stringify(rFresh.finalVec)===JSON.stringify(rStale.finalVec),
    diffs: JSON.stringify(rFresh.finalVec)===JSON.stringify(rStale.finalVec) ? [] : ['finalVec differs between fresh and stale runs of the same vector'],
  });
}

// TC46 — both Tier S subs answered, only one has a stale timestamp -> only that one is
// reported, confirming per-sub (not per-layer) staleness tracking.
{
  const v1 = {RT:1,SC:0,ER:0,AR:0,DS:0,SR:0};
  const v2 = {RT:0,SC:1,ER:0,AR:0,DS:0,SR:0};
  const oldTs = new Date(Date.now() - (SUBACUTE_EXPIRY_DAYS+5)*24*60*60*1000).toISOString();
  const r = computeEngine({precisionVectors:{ grief:v1, life_transitions:v2 }, subacuteTimestamps:{ grief:oldTs }});
  results.push({ name: 'TC46 (v6.2) mixed staleness reports only the stale sub', pass: JSON.stringify(r.staleSubacuteSubs)==='["grief"]', diffs: JSON.stringify(r.staleSubacuteSubs)==='["grief"]'?[]:[`got ${JSON.stringify(r.staleSubacuteSubs)}`] });
}

// TC47 (v6.2) — live cross-check against BAF_Simulator_v6.html: Tier S's weight and subs
// haven't drifted between core-engine.js and the production HTML. Same "read live, don't
// hand-duplicate" philosophy as TC14.
{
  const fs = require('fs');
  const path = require('path');
  const candidates = [
    path.join(__dirname, 'BAF_Simulator_v6.html'),
    path.join(__dirname, '..', 'BAF_Simulator_v6.html'),
  ];
  const htmlPath = candidates.find(p => fs.existsSync(p));
  let pass = false, diff = null;
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    const snippet = script.slice(script.indexOf('const DIMS'), script.indexOf('const TOTAL_SUBS'));
    const tmp = path.join(require('os').tmpdir(), '_v6_subacute_check.js');
    fs.writeFileSync(tmp, snippet + '\nmodule.exports = { LAYERS };');
    delete require.cache[require.resolve(tmp)];
    const { LAYERS } = require(tmp);
    const idx = LAYERS.findIndex(l => l.id === 'subacute');
    const modIdx = LAYERS.findIndex(l => l.id === 'modulator');
    const subacute = LAYERS[idx];
    const subs = subacute ? subacute.subs.map(s => s.id).sort() : [];
    const weightMatches = subacute && Math.abs(subacute.weight - SUBACUTE_WEIGHT) < 0.0001;
    const subsMatch = JSON.stringify(subs) === JSON.stringify(['grief','life_transitions']);
    const positionOk = idx >= 0 && modIdx >= 0 && idx === modIdx - 1;
    pass = !!(subacute && weightMatches && subsMatch && positionOk);
    if (!pass) diff = `subacute layer: found=${!!subacute}, weight=${subacute&&subacute.weight} (expect ${SUBACUTE_WEIGHT}), subs=${JSON.stringify(subs)}, positioned right before modulator=${positionOk}`;
  } catch (e) {
    diff = e.message;
  }
  results.push({
    name: 'TC47 (v6.2) live production Tier S layer matches core-engine.js (weight, subs, position before modulator)',
    pass, diffs: pass ? [] : [diff],
  });
}

// TC48 (v6.3) — childhood adversity/trauma (ACEs), family layer, ceiling 1.50. This one is
// confidence-CONFIRMED (not reduced) per 3.2b.4, since the Felitti et al. 1998 dose-response
// citation was independently verified as one of the best-replicated effects in the catalogue.
{
  const r = computeEngine({precisionVectors:{ ace:{RT:-0.7,SC:0.4,ER:1.4,AR:0.5,DS:-1.0,SR:-1.5} }});
  check('TC48 (v6.3) ace sub passthrough', r.finalVec, {RT:-0.7,SC:0.4,ER:1.4,AR:0.5,DS:-1.0,SR:-1.5});
  check('TC48b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC49-TC52 — consistency-check.js (continuous-improvement learning-case layer). This is
// a comparison/reporting module, not scoring math -- it never calls computeEngine, so
// these tests exercise it directly against hand-built finalVec + scenario-answer pairs
// rather than through the engine.
{
  const { checkConsistency } = require('../scripts/consistency-check');

  // TC49 — clean agreement: engine strongly positive on RT, and every scenario answer
  // touching RT ('buy-more', 'start-business', 'raise-funding') also implies positive RT.
  {
    const finalVec = { RT: 1.0, SC: 0, ER: 0, AR: 0, DS: 0, SR: 0 };
    const answers = { 'market-crash': 'buy-more', 'job-loss': 'start-business', 'business-failure': 'raise-funding' };
    let pass = true, diff = '';
    try {
      const report = checkConsistency(finalVec, answers);
      const rt = report.perDimension.find(d => d.dimension === 'RT');
      pass = rt.status === 'agree' && rt.touches === 3 && rt.agreements === 3 && rt.contradictions === 0 && Math.abs(rt.confidence - 0.3) < 1e-9;
      if (!pass) diff = `got ${JSON.stringify(rt)}`;
    } catch (e) { pass = false; diff = e.message; }
    results.push({ name: 'TC49 consistency-check: clean agreement (RT, 3/3 scenarios agree)', pass, diffs: pass ? [] : [diff] });
  }

  // TC50 — clear contradiction: same 3 scenario answers (all imply positive RT), but the
  // engine itself is strongly negative on RT.
  {
    const finalVec = { RT: -1.0, SC: 0, ER: 0, AR: 0, DS: 0, SR: 0 };
    const answers = { 'market-crash': 'buy-more', 'job-loss': 'start-business', 'business-failure': 'raise-funding' };
    let pass = true, diff = '';
    try {
      const report = checkConsistency(finalVec, answers);
      const rt = report.perDimension.find(d => d.dimension === 'RT');
      pass = rt.status === 'contradict' && rt.touches === 3 && rt.agreements === 0 && rt.contradictions === 3 && Math.abs(rt.confidence - 0.3) < 1e-9;
      if (!pass) diff = `got ${JSON.stringify(rt)}`;
    } catch (e) { pass = false; diff = e.message; }
    results.push({ name: 'TC50 consistency-check: clear contradiction (RT, 0/3 scenarios agree)', pass, diffs: pass ? [] : [diff] });
  }

  // TC51 — partial/low-confidence: engine mildly positive on RT, but the two scenario
  // answers touching RT point in opposite directions ('sell-half' implies negative,
  // 'start-business' implies positive) -- mixed evidence, low confidence.
  {
    const finalVec = { RT: 0.5, SC: 0, ER: 0, AR: 0, DS: 0, SR: 0 };
    const answers = { 'market-crash': 'sell-half', 'job-loss': 'start-business' };
    let pass = true, diff = '';
    try {
      const report = checkConsistency(finalVec, answers);
      const rt = report.perDimension.find(d => d.dimension === 'RT');
      pass = rt.status === 'partial' && rt.touches === 2 && rt.agreements === 1 && rt.contradictions === 1 && Math.abs(rt.confidence - 0.1) < 1e-9;
      if (!pass) diff = `got ${JSON.stringify(rt)}`;
    } catch (e) { pass = false; diff = e.message; }
    results.push({ name: 'TC51 consistency-check: partial/low-confidence (RT, 1/2 scenarios agree)', pass, diffs: pass ? [] : [diff] });
  }

  // TC52 — validation discipline: an unknown scenario id must throw, not silently ignore.
  {
    let pass = false, diff = '';
    try {
      checkConsistency({ RT: 0, SC: 0, ER: 0, AR: 0, DS: 0, SR: 0 }, { 'not-a-real-scenario': 'buy-more' });
      diff = 'expected checkConsistency to throw on an unknown scenario id, it did not';
    } catch (e) {
      pass = /Unknown scenario id/.test(e.message);
      if (!pass) diff = `threw, but wrong message: ${e.message}`;
    }
    results.push({ name: 'TC52 consistency-check: unknown scenario id rejected', pass, diffs: pass ? [] : [diff] });
  }
}

// TC53 (v6.5) — loneliness / social isolation (Cacioppo & Patrick 2008), social layer,
// ceiling 1.25. Confidence-multiplier not applied (no single quantifiable behavioral
// effect size, same evidence category as cognitive_style) -- closes the one clean gap
// found in the v6.5 catalogue audit (Architecture 3.2b.1 Domain 2 / 3.2b.6).
{
  const r = computeEngine({precisionVectors:{ loneliness:{RT:-0.4,SC:0.5,ER:1.25,AR:0.4,DS:-0.6,SR:-1.1} }});
  check('TC53 (v6.5) loneliness sub passthrough', r.finalVec, {RT:-0.4,SC:0.5,ER:1.25,AR:0.4,DS:-0.6,SR:-1.1});
  check('TC53b completeness = 1/T', {c:r.completeness}, {c:1/TOTAL});
}

// TC54-57 (v6.5) — correlation dampener regression tests. See core-engine.js's
// CORRELATED_PAIRS comment for the full design reasoning (why attachment_style/parenting
// is dampened and why emotional_trauma/stability, a cross-layer overlap, deliberately is
// not). All four use a third family sub (birthorder) alongside the pair under test so the
// layer's slot-count actually changes when folding occurs -- with only the pair answered
// and nothing else, the dampened and undampened averages are numerically identical (both
// reduce to a straight 2-way average), which would prove nothing.

// TC54 — both attachment_style and parenting answered (plus birthorder) -> the pair folds
// into ONE combined (averaged) slot before the family layer average, not two independent
// slots. Family layer = average(combined(attachment_style, parenting), birthorder), i.e.
// a 2-slot average -- NOT average(attachment_style, parenting, birthorder), a 3-slot
// average, which is what the old (undampened) code would have computed.
{
  const attachment_style = {RT:-0.5,SC:0.8,ER:1.3,AR:0.5,DS:-0.9,SR:-1.2};
  const parenting = {RT:0.5,SC:-0.4,ER:-0.3,AR:-0.5,DS:0.7,SR:0.4};
  const birthorder = {RT:1.0,SC:1.0,ER:1.0,AR:1.0,DS:1.0,SR:1.0};
  const r = computeEngine({precisionVectors:{ attachment_style, parenting, birthorder }});
  // combined = average(attachment_style, parenting) = {RT:0, SC:0.2, ER:0.5, AR:0, DS:-0.1, SR:-0.4}
  // expected = average(combined, birthorder), since family is the only answered layer,
  // weight-of-one-layer renormalizes to 1.0 so finalVec == family layerVec exactly.
  const expected = {RT:0.5, SC:0.6, ER:0.75, AR:0.5, DS:0.45, SR:0.3};
  check('TC54 (v6.5) dampener: both attachment_style+parenting answered -> folded to one averaged slot, not two', r.finalVec, expected);
  // Sanity check against what the OLD (undampened) 3-slot average would have given, to make
  // the "not the sum/not double-counted" distinction concrete rather than just asserted.
  const oldUndampened = {RT:1/3, SC:1.4/3, ER:2/3, AR:1/3, DS:0.8/3, SR:0.2/3};
  const differsFromOld = Object.keys(expected).some(k => Math.abs(expected[k] - oldUndampened[k]) > TOL);
  results.push({ name: 'TC54b dampener result differs from the old undampened 3-slot average (proves the fix changed behavior)', pass: differsFromOld, diffs: differsFromOld ? [] : ['expected dampened result to differ from old undampened average, they matched'] });
}

// TC55 — only attachment_style answered (parenting untouched) -> NOT part of any fold
// (dampener requires BOTH members), contributes as a normal individual slot, full weight.
{
  const attachment_style = {RT:-0.5,SC:0.8,ER:1.3,AR:0.5,DS:-0.9,SR:-1.2};
  const birthorder = {RT:1.0,SC:1.0,ER:1.0,AR:1.0,DS:1.0,SR:1.0};
  const r = computeEngine({precisionVectors:{ attachment_style, birthorder }});
  // plain 2-slot average, unaffected by the dampener (parenting was never answered)
  const expected = {RT:0.25, SC:0.9, ER:1.15, AR:0.75, DS:0.05, SR:-0.1};
  check('TC55 (v6.5) dampener: attachment_style alone (no parenting) -> unaffected, full weight', r.finalVec, expected);
}

// TC56 — only parenting answered (attachment_style untouched) -> same guarantee, mirrored.
{
  const parenting = {RT:0.5,SC:-0.4,ER:-0.3,AR:-0.5,DS:0.7,SR:0.4};
  const birthorder = {RT:1.0,SC:1.0,ER:1.0,AR:1.0,DS:1.0,SR:1.0};
  const r = computeEngine({precisionVectors:{ parenting, birthorder }});
  const expected = {RT:0.75, SC:0.3, ER:0.35, AR:0.25, DS:0.85, SR:0.7};
  check('TC56 (v6.5) dampener: parenting alone (no attachment_style) -> unaffected, full weight', r.finalVec, expected);
}

// TC57 — both emotional_trauma and stability answered -> deliberately NOT dampened (see
// core-engine.js's CORRELATED_PAIRS comment: they're a cross-layer overlap -- modulator
// and family respectively -- with no shared layer-average step to fold into). Confirms
// finalVec still matches the plain weighted-layer-blend formula with no special-casing.
{
  const emotional_trauma = {RT:-0.6,SC:0.3,ER:1.5,AR:0.4,DS:-0.8,SR:-1.3};
  const stability = {RT:1,SC:1,ER:1,AR:1,DS:1,SR:1};
  const r = computeEngine({precisionVectors:{ emotional_trauma, stability }});
  // modulator (weight 0.15) = emotional_trauma exactly (only modulator sub answered)
  // family (weight 0.18) = stability exactly (only family sub answered)
  // finalVec = (0.15*emotional_trauma + 0.18*stability) / 0.33 -- plain two-layer blend
  const expected = {RT:0.272727, SC:0.681818, ER:1.227273, AR:0.727273, DS:0.181818, SR:-0.045455};
  check('TC57 (v6.5) emotional_trauma+stability both answered -> cross-layer, no dampening applied (by design)', r.finalVec, expected);
}

// ---- report ----
let passCount = 0;
results.forEach(r=>{
  console.log(`[${r.pass?'PASS':'FAIL'}] ${r.name}`);
  if(!r.pass) r.diffs.forEach(d=>console.log('        '+d));
  if(r.pass) passCount++;
});
console.log(`\n${passCount}/${results.length} checks passed.`);
process.exit(passCount===results.length ? 0 : 1);
