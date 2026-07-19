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
