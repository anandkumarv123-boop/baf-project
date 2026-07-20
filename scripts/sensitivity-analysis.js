// scripts/sensitivity-analysis.js — Phase 1 weight sensitivity analysis.
//
// Perturbs each of the 8 LAYER_WEIGHTS entries at -20%/-10%/0%/+10%/+20% of its own current
// value (rescaling the other 7 proportionally so the pool still sums to 1.00 exactly, same
// mechanism as scripts/ablate-layer-weights.js's fixed +/-0.02 perturbation, generalized to
// a percentage), re-scores all golden profiles (scripts/golden-profiles.js's PROFILES) under
// the perturbed weights via the real, unmodified computeEngine(), and reports:
//   - Overall Score Change: worst-case max-abs delta across DIMS of finalVec
//   - Dimension Change: worst-case delta per individual DIM (not just the max)
//   - Layer Change: worst-case delta of each layer's *normalized contribution*
//     (effectiveWeight-share * that layer's own vector) -- a layer's own vector
//     (layerVecs[l]) never moves from a weight perturbation, only its blend share does, so
//     "layer change" here means contribution-share change, not sub-score change
//   - Completeness Change (confidence proxy, per user decision -- see docs/validation/
//     confidence-validation.md): always 0 for a weight perturbation, since completeness is
//     answered-sub-count driven, not weight driven. Reported explicitly as a verified
//     invariant, not omitted.
//
// Scope note -- three weight-like constants are deliberately NOT perturbed here:
//   - SUBACUTE_WEIGHT, SAME_LAYER_PAIR_WEIGHT, CROSS_LAYER_DISCOUNT are plain `const`
//     primitives that computeEngine() closes over internally (core-engine.js's own module
//     scope), not read from the exported module.exports object at call time. Empirically
//     verified: reassigning engine.SUBACUTE_WEIGHT (or the other two) is a complete no-op on
//     computeEngine()'s output -- unlike LAYER_WEIGHTS, which IS an object whose properties
//     both the exported reference and computeEngine's internal reads share, so external
//     mutation of engine.LAYER_WEIGHTS[l] genuinely changes scoring. Perturbing the other
//     three would require editing core-engine.js's source (out of scope for a read-only
//     diagnostic) or reimplementing their effect externally (which this project's own
//     convention explicitly avoids -- see ablate-layer-weights.js's header: "no scoring math
//     is reimplemented here"). A source change to make them live-tunable is a legitimate
//     follow-up but is its own decision, not bundled into this diagnostic.
//   - NEUTRAL_EPSILON (scripts/consistency-check.js) is a consistency-check threshold wired
//     into checkConsistency/server.js -- it never feeds computeEngine()/finalVec at all, so
//     perturbing it cannot move any metric this script measures.
//
// Pure in-memory computation, same guarantee as ablate-layer-weights.js: LAYER_WEIGHTS is
// mutated on the already-required module object and restored after every single
// perturbation (checked via an exact-equality assertion); nothing is ever written to
// src/core-engine.js on disk.
//
// Usage: node scripts/sensitivity-analysis.js  (or: npm run sensitivity-analysis)
// Writes: docs/reports/sensitivity-analysis.{csv,json,md}

const fs = require('fs');
const path = require('path');
const engine = require('../src/core-engine');
const { PROFILES } = require('./golden-profiles');
const pkg = require('../package.json');

const DELTA_PCTS = [-0.20, -0.10, 0, 0.10, 0.20];
const DRIFT_THRESHOLD = 0.05; // same convention as ablate-layer-weights.js / compare-golden.js

const REPORTS_DIR = path.join(__dirname, '..', 'docs', 'reports');

const originalLayerWeights = { ...engine.LAYER_WEIGHTS };
const layerKeys = Object.keys(originalLayerWeights);

function scoreProfile(p) {
  return engine.computeEngine({
    precisionVectors: p.precisionVectors,
    subacuteTimestamps: p.subacuteTimestamps || {},
  });
}

function maxAbsDeltaVec(vecA, vecB) {
  let max = 0;
  engine.DIMS.forEach(k => {
    const d = Math.abs((vecA[k] || 0) - (vecB[k] || 0));
    if (d > max) max = d;
  });
  return max;
}

function deltaVec(vecA, vecB) {
  const out = {};
  engine.DIMS.forEach(k => { out[k] = (vecA[k] || 0) - (vecB[k] || 0); });
  return out;
}

// Mirrors core-engine.js's own effectiveWeights/normW formula (core-engine.js:250-263),
// reconstructed here only to expose each layer's normalized contribution *share* for
// reporting -- computeEngine() itself remains the sole source of subScores/layerVecs/
// finalVec; nothing about how a sub-score or layer average is computed is reimplemented.
function layerContribution(result) {
  const subacuteAnswered = result.layerVecs.subacute !== null;
  const shrink = subacuteAnswered ? (1 - engine.SUBACUTE_WEIGHT) : 1;
  const effectiveWeights = {};
  layerKeys.forEach(l => { effectiveWeights[l] = engine.LAYER_WEIGHTS[l] * shrink; });
  if (subacuteAnswered) effectiveWeights.subacute = engine.SUBACUTE_WEIGHT;

  const answeredLayers = engine.ALL_LAYER_IDS.filter(l => result.layerVecs[l] !== null);
  const weightSum = answeredLayers.reduce((a, l) => a + effectiveWeights[l], 0) || 1;

  const contribution = {};
  engine.ALL_LAYER_IDS.forEach(l => {
    if (result.layerVecs[l] === null) { contribution[l] = null; return; }
    const normW = effectiveWeights[l] / weightSum;
    contribution[l] = engine.scaleVec(result.layerVecs[l], normW);
  });
  return contribution;
}

function restoreLayerWeights() {
  layerKeys.forEach(l => { engine.LAYER_WEIGHTS[l] = originalLayerWeights[l]; });
}

function assertRestored(label) {
  const mismatch = layerKeys.find(l => engine.LAYER_WEIGHTS[l] !== originalLayerWeights[l]);
  if (mismatch) {
    throw new Error(`LAYER_WEIGHTS.${mismatch} not restored bit-for-bit after ${label}`);
  }
}

// --- baseline (unperturbed) ---
const baselineResults = PROFILES.map(scoreProfile);
const baselineContributions = baselineResults.map(layerContribution);

// --- perturb + measure ---
const results = {}; // { layer: { pct: { overallScoreChangeWorst, dimensionChangeWorst, layerContributionChangeWorst, completenessChangeWorst, perProfile: [...] } } }

layerKeys.forEach(layer => {
  results[layer] = {};
  DELTA_PCTS.forEach(pct => {
    const origW = originalLayerWeights[layer];
    const newW = origW * (1 + pct);
    const othersOrigSum = 1 - origW;
    const othersNewSum = 1 - newW;
    const scale = othersOrigSum === 0 ? 1 : othersNewSum / othersOrigSum;

    engine.LAYER_WEIGHTS[layer] = newW;
    layerKeys.forEach(other => {
      if (other === layer) return;
      engine.LAYER_WEIGHTS[other] = originalLayerWeights[other] * scale;
    });

    let overallScoreChangeWorst = 0;
    const dimensionChangeWorst = engine.zeroVec();
    const layerContributionChangeWorst = {};
    engine.ALL_LAYER_IDS.forEach(l => { layerContributionChangeWorst[l] = 0; });
    let completenessChangeWorst = 0;
    const perProfile = [];

    PROFILES.forEach((p, i) => {
      const perturbed = scoreProfile(p);
      const base = baselineResults[i];

      const overallScoreChange = maxAbsDeltaVec(perturbed.finalVec, base.finalVec);
      if (overallScoreChange > overallScoreChangeWorst) overallScoreChangeWorst = overallScoreChange;

      const dChange = deltaVec(perturbed.finalVec, base.finalVec);
      engine.DIMS.forEach(k => {
        if (Math.abs(dChange[k]) > Math.abs(dimensionChangeWorst[k])) dimensionChangeWorst[k] = dChange[k];
      });

      const perturbedContribution = layerContribution(perturbed);
      const baseContribution = baselineContributions[i];
      const layerContributionChange = {};
      engine.ALL_LAYER_IDS.forEach(l => {
        if (perturbedContribution[l] === null || baseContribution[l] === null) {
          layerContributionChange[l] = 0;
          return;
        }
        const d = maxAbsDeltaVec(perturbedContribution[l], baseContribution[l]);
        layerContributionChange[l] = d;
        if (d > layerContributionChangeWorst[l]) layerContributionChangeWorst[l] = d;
      });

      const completenessChange = Math.abs(perturbed.completeness - base.completeness);
      if (completenessChange > completenessChangeWorst) completenessChangeWorst = completenessChange;

      perProfile.push({
        id: p.id, overallScoreChange, dimensionChange: dChange, layerContributionChange, completenessChange,
      });
    });

    results[layer][pct] = {
      newWeight: newW, overallScoreChangeWorst, dimensionChangeWorst, layerContributionChangeWorst,
      completenessChangeWorst, perProfile,
    };

    restoreLayerWeights();
    assertRestored(`${layer} @ ${pct}`);
  });
});

restoreLayerWeights(); // belt-and-braces; already restored after every iteration above
assertRestored('final pass');

// --- write CSV ---
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const csvHeader = [
  'layer', 'delta_pct', 'new_weight', 'overall_score_change_worst',
  ...engine.DIMS.map(k => `dim_${k}_worst`),
  ...engine.ALL_LAYER_IDS.map(l => `contrib_${l}_worst`),
  'completeness_change_worst',
];
const csvRows = [csvHeader.join(',')];
layerKeys.forEach(layer => {
  DELTA_PCTS.forEach(pct => {
    const r = results[layer][pct];
    const row = [
      layer, pct, r.newWeight.toFixed(4), r.overallScoreChangeWorst.toFixed(4),
      ...engine.DIMS.map(k => r.dimensionChangeWorst[k].toFixed(4)),
      ...engine.ALL_LAYER_IDS.map(l => r.layerContributionChangeWorst[l].toFixed(4)),
      r.completenessChangeWorst.toFixed(4),
    ];
    csvRows.push(row.join(','));
  });
});
fs.writeFileSync(path.join(REPORTS_DIR, 'sensitivity-analysis.csv'), csvRows.join('\n') + '\n');

// --- write JSON ---
const jsonOut = {
  generatedAt: new Date().toISOString(),
  engineVersion: pkg.version,
  deltaPcts: DELTA_PCTS,
  driftThreshold: DRIFT_THRESHOLD,
  perturbedWeights: layerKeys,
  excludedConstants: {
    SUBACUTE_WEIGHT: 'const primitive closed over internally by computeEngine(); external mutation of the exported copy is a verified no-op on scoring. Perturbing it requires a core-engine.js source change, out of scope for this read-only diagnostic.',
    SAME_LAYER_PAIR_WEIGHT: 'same reason as SUBACUTE_WEIGHT.',
    CROSS_LAYER_DISCOUNT: 'same reason as SUBACUTE_WEIGHT.',
    NEUTRAL_EPSILON: 'a consistency-check threshold (scripts/consistency-check.js) that never feeds computeEngine()/finalVec at all.',
  },
  results: layerKeys.reduce((acc, layer) => {
    acc[layer] = DELTA_PCTS.reduce((accP, pct) => {
      accP[pct] = results[layer][pct];
      return accP;
    }, {});
    return acc;
  }, {}),
};
fs.writeFileSync(path.join(REPORTS_DIR, 'sensitivity-analysis.json'), JSON.stringify(jsonOut, null, 2) + '\n');

// --- write Markdown ---
const md = [];
md.push('# Weight Sensitivity Analysis');
md.push('');
md.push(`Generated ${jsonOut.generatedAt} against engine v${pkg.version}. Perturbs each of the 8`);
md.push('`LAYER_WEIGHTS` entries at -20%/-10%/0%/+10%/+20% of its own value (rescaling the other 7');
md.push('proportionally so the pool still sums to 1.00), re-scores every golden profile');
md.push('(`scripts/golden-profiles.js`) via the real `computeEngine()`, and reports worst-case');
md.push('(max across profiles) drift. Full per-profile detail: `sensitivity-analysis.json`.');
md.push('Machine-readable summary: `sensitivity-analysis.csv`.');
md.push('');
md.push('**Not perturbed here** (see script header for the full reasoning): `SUBACUTE_WEIGHT`,');
md.push('`SAME_LAYER_PAIR_WEIGHT`, and `CROSS_LAYER_DISCOUNT` are `const` primitives that');
md.push('`computeEngine()` closes over internally — mutating the exported copies is a verified');
md.push('no-op on scoring, unlike `LAYER_WEIGHTS` (a mutable object). `NEUTRAL_EPSILON` never');
md.push('feeds `computeEngine()` at all.');
md.push('');
md.push(`**Completeness (confidence proxy) change: always 0.00 across every perturbation below** —`);
md.push('completeness is driven by which sub-layers are answered, not by layer weights. Verified');
md.push('invariant, not an omission. See `docs/validation/confidence-validation.md`.');
md.push('');
md.push('## Overall Score Change (worst-case across golden profiles)');
md.push('');
md.push(`| Layer | ${DELTA_PCTS.map(p => `${(p * 100).toFixed(0)}%`).join(' | ')} |`);
md.push(`|---|${DELTA_PCTS.map(() => '---').join('|')}|`);
let exceedCount = 0;
layerKeys.forEach(layer => {
  const cells = DELTA_PCTS.map(pct => {
    const v = results[layer][pct].overallScoreChangeWorst;
    if (v > DRIFT_THRESHOLD) exceedCount++;
    return v.toFixed(4) + (v > DRIFT_THRESHOLD ? ' !' : '');
  });
  md.push(`| ${layer} (${originalLayerWeights[layer]}) | ${cells.join(' | ')} |`);
});
md.push('');
md.push(`${exceedCount}/${layerKeys.length * DELTA_PCTS.length} perturbations exceed the ${DRIFT_THRESHOLD} drift threshold (baseline 0% rows are trivially 0 and never flag).`);
md.push('');
md.push('## Dimension Change (worst-case per DIM, at the largest tested perturbation +/-20%)');
md.push('');
md.push(`| Layer | ${engine.DIMS.join(' | ')} | (at -20%) |`);
md.push(`|---|${engine.DIMS.map(() => '---').join('|')}|---|`);
layerKeys.forEach(layer => {
  const neg = results[layer][-0.20].dimensionChangeWorst;
  const cells = engine.DIMS.map(k => (neg[k] >= 0 ? '+' : '') + neg[k].toFixed(4));
  md.push(`| ${layer} | ${cells.join(' | ')} | |`);
});
md.push('');
md.push('## Layer Contribution Change (worst-case, at +/-20% — shows cross-layer propagation)');
md.push('');
md.push('Perturbing one layer\'s weight changes every *other* layer\'s normalized contribution');
md.push('share too (renormalization), even though no other layer\'s own vector moves. Rows =');
md.push('perturbed layer, columns = which layer\'s contribution shifted, at the -20% delta.');
md.push('');
md.push(`| Perturbed \\ Affected | ${engine.ALL_LAYER_IDS.join(' | ')} |`);
md.push(`|---|${engine.ALL_LAYER_IDS.map(() => '---').join('|')}|`);
layerKeys.forEach(layer => {
  const worst = results[layer][-0.20].layerContributionChangeWorst;
  const cells = engine.ALL_LAYER_IDS.map(l => worst[l].toFixed(4));
  md.push(`| ${layer} | ${cells.join(' | ')} |`);
});
md.push('');

fs.writeFileSync(path.join(REPORTS_DIR, 'sensitivity-analysis.md'), md.join('\n') + '\n');

console.log(`Wrote ${path.join(REPORTS_DIR, 'sensitivity-analysis.csv')}`);
console.log(`Wrote ${path.join(REPORTS_DIR, 'sensitivity-analysis.json')}`);
console.log(`Wrote ${path.join(REPORTS_DIR, 'sensitivity-analysis.md')}`);
console.log(`${exceedCount}/${layerKeys.length * DELTA_PCTS.length} perturbations exceed the ${DRIFT_THRESHOLD} drift threshold.`);
