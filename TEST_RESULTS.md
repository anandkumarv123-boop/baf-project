# BAF Engine — Test Results

**Generated:** 2026-07-12T06:20:17Z (UTC)
**Node version:** v24.15.0
**Commands run:** `node tests/test-cases.js`, `node scripts/backtest.js`, `node scripts/compare-golden.js`

## Summary

These results confirm code correctness and internal consistency only — they show that
the scoring engine's math is implemented as specified, is stable under randomized fuzzing,
and has not drifted from its own prior baseline. They are **not** evidence of real-world
predictive accuracy: no human-subject data has been collected yet via the
`BAF_Questionnaire.docx` / Section 9.4 protocol, so nothing here speaks to whether the
underlying framework actually predicts anything about real people.

---

## 1. test-cases.js — hand-derived exact cases

- **Total checks:** 88
- **Passed:** 88
- **Failed:** 0

No failures to report — every check (TC1–TC48, including all sub-checks) passed exactly
against its expected vector/completeness value. Coverage spans: empty/zero/max-boundary
inputs, single-sub and multi-layer renormalization, all 25 v6.1 confidence-corrected
ceilings, Tier S presence/absence/staleness, and the v6.3 `ace` sub-layer.

*(Format note: had any check failed, this section would list, per failing check, the exact
expected vs. actual values for every mismatched dimension — the harness already captures
this via `diffs` in `tests/test-cases.js`; there was simply nothing to show this run.)*

---

## 2. backtest.js — randomized fuzz/invariant sweep

- **Total trials:** 3001 (3000 randomized + 1 deterministic)
- **Passed:** 3001 (100.00%)
- **Failed:** 0

### Breakdown by invariant

| Invariant | Checks run | Violations |
|---|---:|---:|
| finite (no NaN/undefined in `finalVec`) | 18,000 | 0 |
| clamp bounds (`\|subScore\| <= 2`) | 456,000 | 0 |
| weight-renormalization + Tier-S reserved-slice math | 21,000 | 0 |
| Tier S "falls back to exact 8-layer weighting" identity (deterministic, 1 trial) | 1 | 0 |

Clamp-check volume scales with how many sub-layers are answered per trial (more answered
subs → more per-trial clamp assertions), which is why it dominates the total and varies
sharply by completeness level below.

### Breakdown by completeness level

| Level | Trials | Passed | Failed | Finite checks | Clamp checks | Weight/Tier-S checks |
|---|---:|---:|---:|---:|---:|---:|
| 10% | 1000 | 1000 | 0 | 6,000 | 30,000 | 7,000 |
| 50% | 1000 | 1000 | 0 | 6,000 | 144,000 | 7,000 |
| 100% | 1000 | 1000 | 0 | 6,000 | 282,000 | 7,000 |

All three completeness tiers — sparse (10%), mixed (50%), and fully-answered (100%) —
passed every invariant with zero violations, including the ~30% of answered sub-layers
per trial that were deliberately given out-of-range (beyond ±2) raw input to exercise the
clamp path specifically.

---

## 3. compare-golden.js — drift check against `golden-profiles/v6.3-baseline.json`

- **Baseline:** v6.3, generated 2026-07-11T14:34:12.671Z, 15 profiles
- **Significant-drift threshold:** `|delta| > 0.05` on any dimension
- **Flagged:** 0 / 15

| Profile | RT Δ | SC Δ | ER Δ | AR Δ | DS Δ | SR Δ | Exceeded 0.05? |
|---|---:|---:|---:|---:|---:|---:|---|
| empty-input | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| single-layer-geo-only | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| single-layer-modulator-only | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| tier-s-only-grief | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| tier-s-only-both-fresh | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| tier-s-stale-plus-full | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| all-zero-full | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| all-max-full | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| sparse-20pct-risk-averse | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| sparse-20pct-high-scarcity-ego-threat | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| balanced-50pct-resilient-professional | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| balanced-40pct-anxious-depleted | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| sparse-tier-s-plus-two-layers | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| full-100pct-mixed-realistic | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |
| out-of-range-clamp-check | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | No |

No significant drift detected on any profile or dimension. Per `scripts/compare-golden.js`'s
own design, this is a report for manual review before merging, not an automated merge gate.
