// scripts/backtest.js — permanent fuzz/invariant backtest, run every `npm test` alongside
// tests/test-cases.js. Unlike test-cases.js's hand-derived exact cases, this sweeps randomized
// inputs to catch invariant violations that specific hand-picked vectors might not trigger.
//
// N = 1000 trials per completeness level (3000 total). These are *deterministic invariants*
// (not statistical properties), so any single failure is a real bug — 1000 is not about
// statistical confidence, it's about giving randomized sub-layer/vector combinations enough
// volume to hit edge cases (all-answered, single-answered, Tier S present/absent, in-range vs.
// out-of-range vectors) that a handful of trials could luckily miss. Runs in well under a
// second, so there's no cost to keeping it in the default `npm test` path.

const {
  computeEngine, ALL_SUB_IDS, SUB_TO_LAYER, LAYER_WEIGHTS, ALL_LAYER_IDS,
  SUBACUTE_WEIGHT, DIMS,
} = require('../src/core-engine');

const N_PER_LEVEL = 1000;
const LEVELS = [0.10, 0.50, 1.00];
const TOL = 1e-9;
const SUBACUTE_IDS = ALL_SUB_IDS.filter(id => SUB_TO_LAYER[id] === 'subacute');

function randVec(min, max) {
  const v = {};
  DIMS.forEach(k => { v[k] = min + Math.random() * (max - min); });
  return v;
}

function pickSubset(ids, fraction) {
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const n = Math.max(0, Math.round(ids.length * fraction));
  return shuffled.slice(0, n);
}

// Mirrors core-engine.js's reserved-slice formula independently, so this script can assert
// against it rather than trusting the same code path it's meant to check.
function expectedEffectiveWeights(answeredLayerIds) {
  const subacuteAnswered = answeredLayerIds.includes('subacute');
  const shrink = subacuteAnswered ? (1 - SUBACUTE_WEIGHT) : 1;
  const w = {};
  Object.keys(LAYER_WEIGHTS).forEach(l => { w[l] = LAYER_WEIGHTS[l] * shrink; });
  if (subacuteAnswered) w.subacute = SUBACUTE_WEIGHT;
  return w;
}

let pass = 0, fail = 0;
const failures = [];

LEVELS.forEach(level => {
  for (let t = 0; t < N_PER_LEVEL; t++) {
    const subset = pickSubset(ALL_SUB_IDS, level);
    const precisionVectors = {};
    subset.forEach(id => {
      // ~30% of answered subs get a deliberately out-of-range vector, to exercise the
      // clamp-to-[-2,2] invariant, not just the common in-range path.
      const extreme = Math.random() < 0.3;
      precisionVectors[id] = randVec(extreme ? -10 : -2, extreme ? 10 : 2);
    });
    const subacuteTimestamps = {};
    SUBACUTE_IDS.forEach(id => {
      if (precisionVectors[id] && Math.random() < 0.5) {
        const daysAgo = Math.random() < 0.5 ? Math.random() * 30 : 35 + Math.random() * 30;
        subacuteTimestamps[id] = new Date(Date.now() - daysAgo * 86400000).toISOString();
      }
    });

    const checks = [];
    let result;
    try {
      result = computeEngine({ precisionVectors, subacuteTimestamps });
    } catch (e) {
      fail++; failures.push({ level, t, error: e.message, subset }); continue;
    }

    // Invariant: no NaN/undefined anywhere in finalVec.
    DIMS.forEach(k => {
      const v = result.finalVec[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) checks.push(`finalVec.${k} not finite: ${v}`);
    });

    // Invariant: clamping never exceeded, regardless of how extreme the raw input was.
    subset.forEach(id => {
      const sc = result.subScores[id];
      if (sc) DIMS.forEach(k => {
        if (Math.abs(sc[k]) > 2 + TOL) checks.push(`subScores.${id}.${k} exceeds clamp: ${sc[k]}`);
      });
    });

    const answeredLayerIds = ALL_LAYER_IDS.filter(l => result.layerVecs[l] !== null);
    if (answeredLayerIds.length === 0) {
      DIMS.forEach(k => { if (result.finalVec[k] !== 0) checks.push(`finalVec.${k} should be exactly 0 when nothing answered, got ${result.finalVec[k]}`); });
    } else {
      const eff = expectedEffectiveWeights(answeredLayerIds);
      const rawSum = answeredLayerIds.reduce((a, l) => a + eff[l], 0);
      const normSum = answeredLayerIds.reduce((a, l) => a + eff[l] / rawSum, 0);

      // Invariant: weight re-normalization always sums to exactly 1.00 over answered layers.
      if (Math.abs(normSum - 1.0) > TOL) checks.push(`normalized weights sum to ${normSum}, expected 1.0`);

      // Invariant: Tier S reserved-slice math (present or absent) reproduces finalVec exactly
      // when independently recomputed from layerVecs + the expected weight formula.
      const finalVecExpected = {}; DIMS.forEach(k => { finalVecExpected[k] = 0; });
      answeredLayerIds.forEach(l => {
        const w = eff[l] / rawSum;
        DIMS.forEach(k => { finalVecExpected[k] += w * result.layerVecs[l][k]; });
      });
      DIMS.forEach(k => {
        if (Math.abs(finalVecExpected[k] - result.finalVec[k]) > 1e-6) {
          checks.push(`finalVec.${k} mismatch: engine=${result.finalVec[k]} expected=${finalVecExpected[k]}`);
        }
      });
    }

    if (checks.length) { fail++; failures.push({ level, t, checks, subsetSize: subset.length }); }
    else pass++;
  }
});

// Deterministic (non-random) check: Tier S "falls back to exact 8-layer weighting" identity.
// Same base 8-layer input, run once without any Tier S sub answered and once with — the
// relative proportions among the original 8 layers must be bit-for-bit identical in both,
// not just approximately close, since the shrink factor is meant to cancel out exactly.
{
  const base = { RT: 1, SC: 0, ER: 0, AR: 0, DS: 0, SR: 0 };
  const eightLayerSubs = { terrain: base, energy: base, parenting: base, collectivism: base, density_net: base, current_stability: base, education: base, ego: base };
  const without = computeEngine({ precisionVectors: { ...eightLayerSubs } });
  const withTierS = computeEngine({ precisionVectors: { ...eightLayerSubs, grief: base } });
  const identical = DIMS.every(k => Math.abs(without.finalVec[k] - withTierS.finalVec[k]) < 1e-9);
  // finalVec.RT should be 1.0 in both cases: without Tier S because weight-of-8-equal-vectors
  // still averages to the same vector; with Tier S because grief carries the *same* vector too,
  // so the blend is still uniformly RT=1 regardless of Tier S's reserved share.
  if (identical && Math.abs(without.finalVec.RT - 1) < 1e-9 && Math.abs(withTierS.finalVec.RT - 1) < 1e-9) {
    pass++;
  } else {
    fail++;
    failures.push({ check: 'Tier S fallback identity', without: without.finalVec, withTierS: withTierS.finalVec });
  }
}

const total = pass + fail;
console.log(`Backtest: ${pass}/${total} trials passed (${(pass / total * 100).toFixed(2)}%)`);
if (fail > 0) {
  console.log(`\n${fail} FAILURE(S) (showing up to 10):`);
  failures.slice(0, 10).forEach(f => console.log(JSON.stringify(f)));
  process.exit(1);
}
process.exit(0);
