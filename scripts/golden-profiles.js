// scripts/golden-profiles.js — defines a fixed set of representative input profiles and
// scores them through the current engine. Run standalone to (re)generate the baseline:
//   node scripts/golden-profiles.js
// The PROFILES export is the single source of truth reused by scripts/compare-golden.js,
// so both scripts always score the exact same fixed inputs.
//
// Coverage: completeness spans ~20%/~50%/100% of the 47 sub-layers; layer coverage spans
// single-layer-only, multi-layer, and all-layer; includes Tier-S-only, Tier-S-alongside-
// partial, Tier-S-stale, and the two engine-wide boundary cases (all-zero, all-max).

const path = require('path');
const fs = require('fs');
const { computeEngine } = require('../src/core-engine');

const v = (RT, SC, ER, AR, DS, SR) => ({ RT, SC, ER, AR, DS, SR });
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const PROFILES = [
  {
    id: 'empty-input',
    description: '0% completeness — nothing answered. Boundary case: must score exactly zero.',
    precisionVectors: {},
  },
  {
    id: 'single-layer-geo-only',
    description: 'Single-layer-only: all 3 geo subs answered, nothing else. Weight-of-one-layer renormalizes to 1.0.',
    precisionVectors: {
      terrain: v(2, 1, 1, -1, 0, 1),
      climate: v(1, 1, 1, 0, 0, 1),
      density: v(0, 1, 1, 0, 0, -1),
    },
  },
  {
    id: 'single-layer-modulator-only',
    description: 'Single-layer-only: 3 of 12 modulator subs answered (ego, stress, sleep), nothing else.',
    precisionVectors: {
      ego: v(-1, 1, 2, 1, -1, -2),
      stress: v(-1, 1, 2, 1, -1, -2),
      sleep: v(0, 0, 1.5, 0, 0, -1),
    },
  },
  {
    id: 'tier-s-only-grief',
    description: 'Tier-S-only edge case: grief answered alone, everything else empty.',
    precisionVectors: { grief: v(-0.7, 0.4, 1.25, 0.3, -0.9, -1.1) },
  },
  {
    id: 'tier-s-only-both-fresh',
    description: 'Tier-S-only edge case: both grief and life_transitions answered, fresh timestamps, nothing else.',
    precisionVectors: {
      grief: v(-0.6, 0.3, 1.1, 0.3, -0.8, -1.0),
      life_transitions: v(0.5, 0.3, 1.1, 0.3, -0.6, -1.0),
    },
    subacuteTimestamps: { grief: daysAgo(1), life_transitions: daysAgo(1) },
  },
  {
    id: 'tier-s-stale-plus-full',
    description: 'Tier S answered but stale (40 days old), alongside a fully-answered engine (100% completeness). Checks the stale flag stays informational-only even at full completion.',
    precisionVectors: 'ALL_ZERO_PLUS_TIER_S', // resolved below
    subacuteTimestamps: { grief: daysAgo(40), life_transitions: daysAgo(40) },
  },
  {
    id: 'all-zero-full',
    description: '100% completeness, every sub-layer at the zero vector. Boundary case: must score exactly zero regardless of weighting.',
    precisionVectors: 'ALL_ZERO',
  },
  {
    id: 'all-max-full',
    description: '100% completeness, every sub-layer at +2 on every dimension. Boundary case: must score exactly +2 on every dimension.',
    precisionVectors: 'ALL_MAX',
  },
  {
    id: 'sparse-20pct-risk-averse',
    description: '~20% completeness (9/47 subs), a cautious/risk-averse persona spread across geo, bio, econ.',
    precisionVectors: {
      terrain: v(-1, 2, -1, 1, -1, 2), climate: v(-1, 0, -1, 0, 0, 1), density: v(0, -1, -1, 0, 1, 1),
      energy: v(-1, 0, 1, 1, -1, -2), health: v(-1, 0, 1, 0, 0, -1),
      current_stability: v(-2, 1, 2, 1, -1, -2), formative_scarcity: v(-1, 1, 1, 1, -1, -1),
      time_pressure: v(0.8, 0.4, 1.5, 0.6, -1.2, -1.3), dehydration: v(-0.3, 0.1, 0.5, 0.2, -0.5, -0.75),
    },
  },
  {
    id: 'sparse-20pct-high-scarcity-ego-threat',
    description: '~20% completeness (10/47 subs), a "financial scarcity + fragile ego" persona spread across econ, modulator, family.',
    precisionVectors: {
      current_stability: v(-2, 1, 2, 1, -1, -2), formative_scarcity: v(-1, 1, 1, 1, -1, -1), time_pressure: v(0.8, 0.4, 1.5, 0.6, -1.2, -1.3),
      ego: v(-1, 1, 2, 1, -1, -2), shame: v(-1.2, 1.2, 2.0, 1.0, -1.5, -2.0), core_values: v(-0.4, 0.7, 0.9, 0.7, -1.2, -1.5),
      stability: v(-1, 0, 2, 0, -1, -2), attachment_style: v(-0.5, 0.8, 1.3, 0.5, -0.9, -1.2), ace: v(-0.7, 0.4, 1.4, 0.5, -1.0, -1.5),
      grief: v(-0.7, 0.4, 1.25, 0.3, -0.9, -1.1),
    },
    subacuteTimestamps: { grief: daysAgo(2) },
  },
  {
    id: 'balanced-50pct-resilient-professional',
    description: '~50% completeness (24/47 subs), a "resilient, analytical professional" persona across most layers, Tier S untouched.',
    precisionVectors: {
      terrain: v(1, 0, 0, -1, 1, 1), climate: v(0.5, 0, -1, 0, 0.5, 1), density: v(0, 0.5, 0.5, 0, 0, -0.5),
      energy: v(0.5, 0, -0.5, 0, 0.5, 1.5), health: v(1, 0, -1, 0, 0, 1), cognitive_style: v(-0.3, -0.2, -0.3, -0.2, 1.5, 0.4),
      parenting: v(0, 0, -1, 0, 2, 2), birthorder: v(-0.5, 0.5, -0.5, 1, 0.5, 0.5), past_failures: v(0.3, -0.1, -0.2, -0.1, 0.5, 0.7),
      collectivism: v(1, -1, 0, -1, 1, 0), tradition: v(1, -1, 0, -1, 1, 0),
      density_net: v(0, 1, -1, 0, 0, 1), digital_ratio: v(0, 1, -1, 0, 0, 1),
      current_stability: v(1, -1, -1, -1, 1, 1), formative_scarcity: v(1, -1, -1, -1, 1, 1),
      education: v(0, -1, -1, -1, 2, 1), schema_flex: v(1, 0, -1, -1, 2, 1),
      ego: v(1, 0, -1, 0, 1, 2), stress: v(1, 0, -1, 0, 1, 1), sleep: v(0, 0, -1, 0, 0, 1),
      core_values: v(0.2, -0.3, -0.3, -0.3, 0.8, 0.8), decision_fatigue: v(0.3, -0.2, -0.2, -0.2, 0.8, 0.5),
      sunk_cost: v(0.6, -0.2, -0.2, -0.3, 1.0, 0.4), time_pressure: v(0.3, -0.1, -0.3, -0.2, 0.6, 0.5),
    },
  },
  {
    id: 'balanced-40pct-anxious-depleted',
    description: '~40% completeness (19/47 subs), an "anxious, depleted" persona weighted toward modulator/family negatives, includes stale Tier S.',
    precisionVectors: {
      stability: v(-1, 0, 2, 0, -1, -2), attachment_style: v(-0.5, 0.8, 1.3, 0.5, -0.9, -1.2), past_failures: v(-0.6, 0.4, 0.8, 0.4, -0.9, -1.5), ace: v(-0.7, 0.4, 1.4, 0.5, -1.0, -1.5),
      ego: v(-2, 0, 1, 1, -2, -2), stress: v(-1, 1, 2, 1, -1, -2), sleep: v(0, 0, 1.5, 0, 0, -1),
      depression: v(-1.0, 0.3, 0.8, 0.5, -1.2, -1.5), fear_failure: v(-1.5, 0.8, 1.2, 0.9, -1.0, -0.9), emotional_trauma: v(-0.6, 0.3, 1.5, 0.4, -0.8, -1.3),
      anger_resentment: v(0.6, -0.3, 1.5, -0.6, -0.5, -1.2), shame: v(-1.2, 1.2, 2.0, 1.0, -1.5, -2.0), dehydration: v(-0.3, 0.1, 0.5, 0.2, -0.5, -0.75),
      hormonal: v(-0.4, 0.3, 1.25, 0.4, -0.7, -1.0),
      relationship_conflict: v(-0.5, 0.5, 1.25, 0.5, -0.6, -1.1), social_exclusion: v(-0.5, 0.6, 1.5, 0.5, -0.7, -1.3),
      cognitive_overload: v(-0.8, 0.4, 1.2, 0.6, -1.5, -1.0), decision_fatigue: v(-0.5, 0.6, 0.7, 0.9, -1.5, -0.8),
      grief: v(-0.7, 0.4, 1.25, 0.3, -0.9, -1.1),
    },
    subacuteTimestamps: { grief: daysAgo(40) },
  },
  {
    id: 'sparse-tier-s-plus-two-layers',
    description: 'Tier S answered alongside only 2 of the 8 core layers (geo full, bio partial) — exercises reserved-slice math in a sparse, non-full scenario.',
    precisionVectors: {
      terrain: v(2, 0, 0, 0, 0, 0), climate: v(2, 0, 0, 0, 0, 0), density: v(2, 0, 0, 0, 0, 0),
      energy: v(-2, 0, 0, 0, 0, 0), health: v(-2, 0, 0, 0, 0, 0),
      grief: v(2, 0, 0, 0, 0, 0),
    },
  },
  {
    id: 'full-100pct-mixed-realistic',
    description: '100% completeness, all 47 subs answered with a realistic mixed persona (not all-zero/all-max), including fresh Tier S.',
    precisionVectors: 'REALISTIC_MIXED_FULL',
    subacuteTimestamps: { grief: daysAgo(3), life_transitions: daysAgo(10) },
  },
  {
    id: 'out-of-range-clamp-check',
    description: 'Deliberately out-of-range raw inputs (beyond +/-2) across a handful of subs, to confirm clamping stays exact across engine revisions.',
    precisionVectors: {
      terrain: v(5, -9, 0, 0, 0, 0), shame: v(-10, 10, 3, -3, 4, -4), ace: v(3, -3, 2.5, -2.5, 2.1, -2.1),
    },
  },
];

function allSubVectors(fn) {
  const { ALL_SUB_IDS } = require('../src/core-engine');
  const out = {};
  ALL_SUB_IDS.forEach(id => { out[id] = fn(id); });
  return out;
}

// Resolve the string placeholders into real precisionVectors objects, generated from the
// live ALL_SUB_IDS list so this file never has to be hand-updated when a sub-layer is added.
function resolvePlaceholders() {
  const zero = () => v(0, 0, 0, 0, 0, 0);
  const max = () => v(2, 2, 2, 2, 2, 2);
  PROFILES.forEach(p => {
    if (p.precisionVectors === 'ALL_ZERO') {
      p.precisionVectors = allSubVectors(zero);
    } else if (p.precisionVectors === 'ALL_MAX') {
      p.precisionVectors = allSubVectors(max);
    } else if (p.precisionVectors === 'ALL_ZERO_PLUS_TIER_S') {
      p.precisionVectors = allSubVectors(zero);
      p.precisionVectors.grief = v(-0.7, 0.4, 1.25, 0.3, -0.9, -1.1);
      p.precisionVectors.life_transitions = v(0.6, 0.4, 1.25, 0.4, -0.7, -1.1);
    } else if (p.precisionVectors === 'REALISTIC_MIXED_FULL') {
      // deterministic pseudo-random-looking but fixed spread: alternate sign/magnitude
      // pattern seeded by sub-layer index, so it's reproducible without a PRNG dependency.
      const { ALL_SUB_IDS } = require('../src/core-engine');
      const out = {};
      ALL_SUB_IDS.forEach((id, i) => {
        const s = (i % 5) - 2; // -2..2 deterministic cycle
        const t = ((i * 3) % 5) - 2;
        out[id] = v(s * 0.5, t * 0.3, -s * 0.4, t * 0.2, -t * 0.5, s * 0.6);
      });
      p.precisionVectors = out;
    }
  });
}
resolvePlaceholders();

function scoreAll() {
  return PROFILES.map(p => {
    const result = computeEngine({
      precisionVectors: p.precisionVectors,
      subacuteTimestamps: p.subacuteTimestamps || {},
    });
    return {
      id: p.id,
      description: p.description,
      finalVec: result.finalVec,
      completeness: result.completeness,
      answeredSubsTotal: result.answeredSubsTotal,
      totalSubs: result.totalSubs,
      subacuteStale: result.subacuteStale,
      staleSubacuteSubs: result.staleSubacuteSubs,
    };
  });
}

function main() {
  const scored = scoreAll();
  const outDir = path.join(__dirname, '..', 'golden-profiles');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'v6.3-baseline.json');
  const payload = {
    generatedAt: new Date().toISOString(),
    engineVersion: 'v6.3',
    totalProfiles: scored.length,
    profiles: scored,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath} (${scored.length} profiles)`);
}

module.exports = { PROFILES, scoreAll };

if (require.main === module) main();
