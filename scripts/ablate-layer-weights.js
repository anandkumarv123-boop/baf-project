// scripts/ablate-layer-weights.js — sensitivity/ablation diagnostic for LAYER_WEIGHTS, plus
// (Phase 1 / layer importance) baseline contribution and variance stats.
//
// For each of the 8 layers, perturbs its weight by +/-0.02 (rescaling the other 7
// proportionally so the total still sums to 1.00 exactly), re-scores all 15 golden
// profiles (scripts/golden-profiles.js's PROFILES, the same fixed set used by
// scripts/compare-golden.js) under the perturbed weights, and reports the worst-case
// (max absolute, across any profile/dimension) drift from the unperturbed baseline.
//
// Also reports, from the unperturbed baseline only (no perturbation involved):
//   - Layer Contribution: each layer's average normalized weight-share (normW) across
//     golden profiles where it's answered -- "how much of finalVec does this layer
//     typically account for", independent of any ablation.
//   - Dimension Contribution: each layer's average actual contribution vector
//     (normW * layerVecs[l]) -- which DIMS that layer's real contribution leans toward.
//   - Score Variance: variance of the existing +/-0.02 worst-drift pair per layer --
//     a spread stat alongside the existing worst-case (max) number.
//   - Completeness Variance (confidence proxy, per docs/validation/confidence-validation.md):
//     stdev of `completeness` across the golden profiles where that layer has >=1 answered
//     sub. This is a coverage-diversity stat about the profile sample, NOT a drift-caused
//     effect -- perturbing a layer's weight never changes completeness (verified elsewhere,
//     see scripts/sensitivity-analysis.js), so a drift-based version would always be zero;
//     this reinterpretation is the honest, non-trivial version of the same idea.
//
// Pure in-memory computation: LAYER_WEIGHTS is mutated on the already-required module
// object (a plain object is mutable even behind a `const` binding) so every score comes
// from the real, unmodified computeEngine() -- no scoring math is reimplemented here.
// Original values are restored after every single perturbation; nothing is ever written
// to src/core-engine.js on disk. Not wired into npm test -- this is a read-only diagnostic
// to inform how LAYER_WEIGHTS gets tagged in docs/WEIGHTS.md.
//
// Usage: node scripts/ablate-layer-weights.js  (or: npm run ablate-layer-weights)
// Writes: docs/reports/layer-contribution.md (in addition to the stdout report below).

const fs = require('fs');
const path = require('path');
const engine = require('../src/core-engine');
const { PROFILES } = require('./golden-profiles');

const DELTAS = [-0.02, 0.02];
const DRIFT_THRESHOLD = 0.05;

const REPORTS_DIR = path.join(__dirname, '..', 'docs', 'reports');

const originalWeights = { ...engine.LAYER_WEIGHTS };
const layers = Object.keys(originalWeights);

function scoreProfile(p) {
  return engine.computeEngine({
    precisionVectors: p.precisionVectors,
    subacuteTimestamps: p.subacuteTimestamps || {},
  });
}

function maxAbsDelta(vecA, vecB) {
  let max = 0;
  engine.DIMS.forEach(k => {
    const d = Math.abs(vecA[k] - vecB[k]);
    if (d > max) max = d;
  });
  return max;
}

function restoreWeights() {
  layers.forEach(l => { engine.LAYER_WEIGHTS[l] = originalWeights[l]; });
}

// Mirrors core-engine.js's own effectiveWeights/normW formula (core-engine.js:250-263),
// reconstructed here only to expose each layer's normalized contribution for reporting --
// computeEngine() itself remains the sole source of subScores/layerVecs/finalVec.
function layerContribution(result) {
  const subacuteAnswered = result.layerVecs.subacute !== null;
  const shrink = subacuteAnswered ? (1 - engine.SUBACUTE_WEIGHT) : 1;
  const effectiveWeights = {};
  layers.forEach(l => { effectiveWeights[l] = engine.LAYER_WEIGHTS[l] * shrink; });
  if (subacuteAnswered) effectiveWeights.subacute = engine.SUBACUTE_WEIGHT;

  const answeredLayers = engine.ALL_LAYER_IDS.filter(l => result.layerVecs[l] !== null);
  const weightSum = answeredLayers.reduce((a, l) => a + effectiveWeights[l], 0) || 1;

  const normW = {};
  const vec = {};
  engine.ALL_LAYER_IDS.forEach(l => {
    if (result.layerVecs[l] === null) { normW[l] = null; vec[l] = null; return; }
    normW[l] = effectiveWeights[l] / weightSum;
    vec[l] = engine.scaleVec(result.layerVecs[l], normW[l]);
  });
  return { normW, vec };
}

function mean(nums) { return nums.reduce((a, b) => a + b, 0) / nums.length; }
function variance(nums) {
  if (nums.length === 0) return null;
  const m = mean(nums);
  return mean(nums.map(n => (n - m) ** 2));
}

// Baseline: score all 15 profiles once under the real, unperturbed weights.
const baselineResults = PROFILES.map(scoreProfile);
const baselineVecs = baselineResults.map(r => r.finalVec);
const baselineContributions = baselineResults.map(layerContribution);

// --- baseline-only stats: Layer Contribution, Dimension Contribution, Completeness Variance ---
const layerStats = {};
layers.forEach(layer => {
  const normWSamples = [];
  const vecSamples = [];
  const completenessSamplesForLayer = [];
  baselineResults.forEach((r, i) => {
    if (r.layerAnsweredSubs[layer] > 0) completenessSamplesForLayer.push(r.completeness);
    const c = baselineContributions[i];
    if (c.normW[layer] !== null) {
      normWSamples.push(c.normW[layer]);
      vecSamples.push(c.vec[layer]);
    }
  });
  const avgNormW = normWSamples.length ? mean(normWSamples) : null;
  const avgVec = engine.zeroVec();
  if (vecSamples.length) {
    engine.DIMS.forEach(k => { avgVec[k] = mean(vecSamples.map(v => v[k])); });
  }
  const completenessVar = completenessSamplesForLayer.length >= 2
    ? variance(completenessSamplesForLayer) : null;
  layerStats[layer] = {
    avgNormW, avgVec,
    completenessVariance: completenessVar,
    completenessSampleSize: completenessSamplesForLayer.length,
  };
});

const results = {}; // { layer: { [delta]: worstDrift } }

layers.forEach(layer => {
  results[layer] = {};
  DELTAS.forEach(delta => {
    const origW = originalWeights[layer];
    const newW = origW + delta;
    const othersOrigSum = 1 - origW;
    const othersNewSum = 1 - newW;
    const scale = othersNewSum / othersOrigSum;

    engine.LAYER_WEIGHTS[layer] = newW;
    layers.forEach(other => {
      if (other === layer) return;
      engine.LAYER_WEIGHTS[other] = originalWeights[other] * scale;
    });

    let worst = 0;
    PROFILES.forEach((p, i) => {
      const perturbed = scoreProfile(p);
      const d = maxAbsDelta(perturbed.finalVec, baselineVecs[i]);
      if (d > worst) worst = d;
    });
    results[layer][delta] = worst;

    restoreWeights();
  });
});

restoreWeights(); // belt-and-braces; already restored after every iteration above

// --- report ---
let exceedCount = 0;
const lines = [];
lines.push('# Layer Importance Report');
lines.push('');
lines.push(`Generated ${new Date().toISOString()} against engine v${require('../package.json').version}.`);
lines.push('Read-only diagnostic -- informs how LAYER_WEIGHTS is tagged in docs/WEIGHTS.md; not');
lines.push('wired into npm test. See script header for full methodology.');
lines.push('');
lines.push('## Ablation Drift (+/-0.02 absolute perturbation, worst-case across golden profiles)');
lines.push('');
lines.push(`| Layer | δ=${DELTAS[0]} worst drift | δ=+${DELTAS[1]} worst drift | Score Variance |`);
lines.push('|---|---|---|---|');
layers.forEach(layer => {
  const neg = results[layer][DELTAS[0]];
  const pos = results[layer][DELTAS[1]];
  if (neg > DRIFT_THRESHOLD) exceedCount++;
  if (pos > DRIFT_THRESHOLD) exceedCount++;
  const negStr = neg.toFixed(4) + (neg > DRIFT_THRESHOLD ? ' !' : '');
  const posStr = pos.toFixed(4) + (pos > DRIFT_THRESHOLD ? ' !' : '');
  const varStr = variance([neg, pos]).toFixed(4);
  lines.push(`| ${layer} | ${negStr} | ${posStr} | ${varStr} |`);
});
lines.push('');
lines.push(`${exceedCount}/${layers.length * DELTAS.length} perturbations exceed the ${DRIFT_THRESHOLD} drift threshold.`);
lines.push('Score Variance = population variance of the two worst-drift numbers per layer -- a');
lines.push('spread stat alongside the max; with only 2 samples it mostly tracks how asymmetric');
lines.push('the +/- response is (renormalization is not perfectly linear).');
lines.push('');
lines.push('## Layer Contribution & Dimension Contribution (baseline, unperturbed)');
lines.push('');
lines.push('`Avg Weight Share` = each layer\'s average normalized contribution weight (normW)');
lines.push('across golden profiles where it\'s answered -- independent of the ablation above.');
lines.push('`Dimension Lean` = that layer\'s average actual contribution vector (normW *');
lines.push('layerVecs[l]); the dimension(s) with the largest magnitude are what this layer');
lines.push('mostly drives in a typical answered profile.');
lines.push('');
lines.push(`| Layer | Declared Weight | Avg Weight Share | ${engine.DIMS.join(' | ')} |`);
lines.push(`|---|---|---|${engine.DIMS.map(() => '---').join('|')}|`);
layers.forEach(layer => {
  const s = layerStats[layer];
  const shareStr = s.avgNormW === null ? 'n/a (never answered)' : s.avgNormW.toFixed(4);
  const dimCells = engine.DIMS.map(k => (s.avgVec[k] >= 0 ? '+' : '') + s.avgVec[k].toFixed(4));
  lines.push(`| ${layer} | ${originalWeights[layer]} | ${shareStr} | ${dimCells.join(' | ')} |`);
});
lines.push('');
lines.push('## Completeness Variance (confidence-proxy coverage stat, baseline, unperturbed)');
lines.push('');
lines.push('Stdev of `completeness` across the golden profiles where that layer has >=1 answered');
lines.push('sub -- a coverage-diversity stat about the profile sample, NOT a drift-caused effect.');
lines.push('Perturbing a layer\'s weight never changes completeness (see');
lines.push('scripts/sensitivity-analysis.js), so a drift-based version of this stat is always');
lines.push('zero by construction; this is the honest, non-trivial version instead. See');
lines.push('docs/validation/confidence-validation.md for why completeness is used as the');
lines.push('confidence proxy today.');
lines.push('');
lines.push('| Layer | Sample size | Completeness Variance | Completeness Stdev |');
lines.push('|---|---|---|---|');
layers.forEach(layer => {
  const s = layerStats[layer];
  const varStr = s.completenessVariance === null ? 'n/a (<2 profiles)' : s.completenessVariance.toFixed(6);
  const stdevStr = s.completenessVariance === null ? 'n/a' : Math.sqrt(s.completenessVariance).toFixed(4);
  lines.push(`| ${layer} | ${s.completenessSampleSize} | ${varStr} | ${stdevStr} |`);
});
lines.push('');

console.log(lines.join('\n'));

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORTS_DIR, 'layer-contribution.md'), lines.join('\n') + '\n');
console.log(`\nWrote ${path.join(REPORTS_DIR, 'layer-contribution.md')}`);
