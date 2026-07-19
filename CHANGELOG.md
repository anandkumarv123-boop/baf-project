# Changelog

## [6.7.0] - 2026-07-19

### Fixed
- Version metadata now matches shipped features: cross-layer correlation dampener,
  RT monotonicity fix in the `time_pressure` sub-layer, and golden-profile v6.7 baseline.

### Known limitations
- `BAF_Simulator_v6.html` re-implements scoring independently of `src/core-engine.js` and
  does not include the v6.5 same-layer or v6.7 cross-layer dampeners. Scores from the
  simulator will disagree with the API and the test suite for any respondent whose answers
  trigger those dampeners. The simulator is not served by GitHub Pages (Pages publishes
  from `docs/`; the simulator sits at repo root) and is not linked from the respondent-facing
  form, so there is no exposure path for live submissions. Planned resolution: replace the
  simulator's internal scoring with a direct import of `src/core-engine.js`. No fixed
  timeline.

### Documentation
- Introduced `SAME_LAYER_PAIR_WEIGHT = 0.5` in `src/core-engine.js` as a named constant
  replacing the previously-implicit 0.5 fold weight applied to CORRELATED_PAIRS members.
  Behavior-neutral rename; documented in `docs/WEIGHTS.md`.
- Added `NEUTRAL_EPSILON` (0.05, `scripts/consistency-check.js`) to `docs/WEIGHTS.md`
  threshold section — it is wired into live scoring via `checkConsistency` and had been
  undocumented.
- Reclassified `SUBACUTE_EXPIRY_DAYS` (35, `src/core-engine.js`) in `docs/WEIGHTS.md` from
  "adjacent/out of scope" to the threshold section; it is a fresh/stale boundary that
  changes scoring output.
- Removed unenforced per-sub-layer tier-ceiling numeric values (0.75 / 1.00 / 1.25 / 1.50 /
  2.00) from 28 sub-layer title strings and from the "honest disclosure" banner in
  `BAF_Simulator_v6.html`. These numbers were documentation text only, not clamped in code,
  and their provenance could not be defended. Confidence-multiplier phrases (1.00x), the
  global clamp label (-2.00..2.00), and micro-vector data values were preserved. If tiered
  ceilings are reintroduced later, they will be designed in with a stated principle and
  enforced in code.
