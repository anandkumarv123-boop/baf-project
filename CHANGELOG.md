# Changelog

## [Unreleased]

### Added
- Phase 1 (Scientific Scoring) of the BAF v2.0 roadmap: `docs/validation/weight-validation.md`,
  `layer-validation.md`, and `confidence-validation.md` — a companion to `docs/WEIGHTS.md`
  validating why each weight/layer is defensible and how sensitive scoring is to it.
- `scripts/sensitivity-analysis.js` — perturbs the 8 `LAYER_WEIGHTS` at -20%/-10%/0%/+10%/+20%
  against all golden profiles, writing `docs/reports/sensitivity-analysis.{csv,json,md}`.
  Empirically confirmed (and documented) that `SUBACUTE_WEIGHT`, `SAME_LAYER_PAIR_WEIGHT`, and
  `CROSS_LAYER_DISCOUNT` cannot be perturbed the same way `LAYER_WEIGHTS` can — they're `const`
  primitives `computeEngine()` closes over internally, not read from the exported module
  object at call time, unlike `LAYER_WEIGHTS` (a mutable object). Making them tunable is a
  candidate follow-up but is a `core-engine.js` source change, not part of this diagnostic.
- Extended `scripts/ablate-layer-weights.js` with baseline layer contribution, dimension
  contribution, score variance, and completeness-coverage-variance stats, writing
  `docs/reports/layer-contribution.md` in addition to its existing stdout report.
- `npm run ablate-layer-weights` and `npm run sensitivity-analysis` — the former had no npm
  wiring despite already being committed.
- No changes to `src/core-engine.js` or scoring output — all of the above are read-only
  diagnostics, same convention as `scripts/compare-golden.js`.
- Phase 2 (Confidence Engine) of the BAF v2.0 roadmap: `src/confidence/` (`EvidenceCoverage`,
  `ContradictionAnalyzer`, `EvidenceStrength`, `ConfidenceEstimator`, `ConfidenceReport`) and
  `config/confidenceConfig.js` — a per-dimension confidence envelope (`score`, `confidence`,
  `evidenceStrength`, `evidenceCoverage`, `contradictionPenalty`, `metadata` per `RT/SC/ER/AR/
  DS/SR`) computed from an existing `computeEngine()` result. All tunables live in the mutable
  `confidenceConfig.js` object (never `const` primitives) — the direct fix for the failure
  mode Phase 1 found in `SUBACUTE_WEIGHT`/`SAME_LAYER_PAIR_WEIGHT`/`CROSS_LAYER_DISCOUNT`,
  proven by `tests/confidence/mutability.test.js`. `reliability` is deliberately absent
  (deferred to Phase 3, pending a multi-submission data model). See
  `docs/confidence-engine.md`.
- `src/server.js`'s `POST /v1/profile` response gains a new, additive `confidenceReport`
  field; `finalScore`, the existing `confidence` string, and every other field are untouched.
- `npm run test:confidence` (folded into `npm test`) — 5 new test files under
  `tests/confidence/`, same plain `check()`/exit-code convention as `tests/test-cases.js` (no
  new test-framework dependency).
- No changes to `src/core-engine.js` or anything it imports; golden-profile drift is 0/15 by
  construction.

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
- Repositioned `SUBACUTE_EXPIRY_DAYS` (35, `src/core-engine.js`) in `docs/WEIGHTS.md`. It is
  a staleness flag boundary (informational-only, does not affect `finalVec`); the previous
  "adjacent/out of scope" placement understated its documented status, but the description
  of it in the last CHANGELOG entry as "changing scoring output" was wrong and is corrected
  here.
- Removed unenforced per-sub-layer tier-ceiling numeric values (0.75 / 1.00 / 1.25 / 1.50 /
  2.00) from 28 sub-layer title strings and from the "honest disclosure" banner in
  `BAF_Simulator_v6.html`. These numbers were documentation text only, not clamped in code,
  and their provenance could not be defended. Confidence-multiplier phrases (1.00x), the
  global clamp label (-2.00..2.00), and micro-vector data values were preserved. If tiered
  ceilings are reintroduced later, they will be designed in with a stated principle and
  enforced in code.
