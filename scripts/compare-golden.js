// scripts/compare-golden.js — re-scores the fixed profiles from scripts/golden-profiles.js
// against the *current* engine and diffs against the saved baseline
// (golden-profiles/v6.3-baseline.json), per-profile, per-dimension.
//
// This is deliberately NOT wired into `npm test`: drift here is often *expected* (adding or
// re-weighting a sub-layer should shift some profiles' scores), so a pass/fail gate would
// either block legitimate changes or get silenced with --force. Instead this prints a
// human-readable diff and always exits 0 on a clean run (non-zero only on a genuine tooling
// failure — missing baseline, engine crash) — reviewing the diff is a manual step before
// merging, not an automated gate.
//
// Usage: npm run compare-golden

const fs = require('fs');
const path = require('path');
const { DIMS } = require('../src/core-engine');
const { scoreAll } = require('./golden-profiles');

// 0.05 on the engine's -2..2 scale (~1.25% of the full range). Chosen to sit well above
// floating-point noise (~1e-9) and above trivial re-normalization rounding, but well below
// the shift a single re-weighted or newly-added sub-layer typically produces in a layer
// average (adding one sub to a layer of size n shifts that layer's mean by roughly
// (newVec-oldMean)/n, which for the layers in this engine, n=2..12, easily exceeds 0.05
// whenever the new sub's vector meaningfully differs from what was already there).
const SIGNIFICANT_DELTA = 0.05;

const BASELINE_PATH = path.join(__dirname, '..', 'golden-profiles', 'v6.3-baseline.json');

function main() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`No baseline found at ${BASELINE_PATH}. Run "node scripts/golden-profiles.js" first.`);
    process.exit(1);
  }

  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    console.error(`Could not parse baseline JSON: ${e.message}`);
    process.exit(1);
  }

  let current;
  try {
    current = scoreAll();
  } catch (e) {
    console.error(`Engine crashed while re-scoring golden profiles: ${e.message}`);
    process.exit(1);
  }

  const baselineById = {};
  baseline.profiles.forEach(p => { baselineById[p.id] = p; });
  const currentById = {};
  current.forEach(p => { currentById[p.id] = p; });

  const baselineIds = new Set(baseline.profiles.map(p => p.id));
  const currentIds = new Set(current.map(p => p.id));
  const added = [...currentIds].filter(id => !baselineIds.has(id));
  const removed = [...baselineIds].filter(id => !currentIds.has(id));

  console.log(`Baseline: ${baseline.engineVersion || 'unknown'}, generated ${baseline.generatedAt}, ${baseline.profiles.length} profiles`);
  console.log(`Comparing against current engine, ${current.length} profiles`);
  if (added.length) console.log(`\nNEW profiles (no baseline to compare against): ${added.join(', ')}`);
  if (removed.length) console.log(`\nREMOVED profiles (in baseline, not in current set): ${removed.join(', ')}`);
  console.log(`Significant-drift threshold: |delta| > ${SIGNIFICANT_DELTA} on any dimension\n`);

  let flaggedCount = 0;
  const rows = [];

  baseline.profiles.forEach(bp => {
    const cp = currentById[bp.id];
    if (!cp) return; // reported above as REMOVED

    const deltas = {};
    let maxAbsDelta = 0;
    DIMS.forEach(k => {
      const d = cp.finalVec[k] - bp.finalVec[k];
      deltas[k] = d;
      if (Math.abs(d) > Math.abs(maxAbsDelta)) maxAbsDelta = d;
    });
    const significant = Math.abs(maxAbsDelta) > SIGNIFICANT_DELTA;
    const completenessChanged = Math.abs(cp.completeness - bp.completeness) > 1e-9;
    const staleChanged = cp.subacuteStale !== bp.subacuteStale;

    if (significant) flaggedCount++;

    rows.push({ id: bp.id, description: bp.description, deltas, maxAbsDelta, significant, completenessChanged, staleChanged, baseline: bp, current: cp });
  });

  rows.forEach(r => {
    const flag = r.significant ? ' *** SIGNIFICANT DRIFT ***' : '';
    console.log(`[${r.significant ? 'FLAG' : 'ok  '}] ${r.id}${flag}`);
    console.log(`      ${r.description}`);
    if (r.completenessChanged) {
      console.log(`      completeness: ${r.baseline.completeness.toFixed(4)} -> ${r.current.completeness.toFixed(4)} (answeredSubsTotal ${r.baseline.answeredSubsTotal} -> ${r.current.answeredSubsTotal})`);
    }
    if (r.staleChanged) {
      console.log(`      subacuteStale: ${r.baseline.subacuteStale} -> ${r.current.subacuteStale}`);
    }
    const deltaStr = DIMS.map(k => {
      const d = r.deltas[k];
      const marker = Math.abs(d) > SIGNIFICANT_DELTA ? '!' : ' ';
      return `${k}:${d >= 0 ? '+' : ''}${d.toFixed(4)}${marker}`;
    }).join('  ');
    console.log(`      ${deltaStr}`);
  });

  console.log(`\n${flaggedCount}/${rows.length} profiles flagged for significant drift (threshold ${SIGNIFICANT_DELTA}).`);
  if (flaggedCount > 0) {
    console.log('Drift is not automatically a failure -- review whether it matches an intentional change (new/re-weighted sub-layer, migrated Tier S sub, etc.) before merging.');
  } else {
    console.log('No significant drift detected.');
  }

  // Always exits 0 on a clean run (see file header) -- this is a report, not a gate.
  process.exit(0);
}

main();
