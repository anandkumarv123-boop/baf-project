# Confidence Validation Framework

Phase 1 (Scientific Scoring) deliverable. Unlike `weight-validation.md` and
`layer-validation.md`, this document is **not** an audit of an existing subsystem — there is
no confidence engine in this codebase today. Grep confirms zero hits for a computed confidence
score anywhere in `src/` or `scripts/`; the only matches for "confidence" are unenforced
doc-comment text (the per-sub-layer "confidence ceiling"/"confidence-correction" language in
`docs/WEIGHTS.md` section (b) and `BAF_Simulator_v6.html`'s title strings, none of it clamped
in code).

This document does two things instead: (1) honestly documents today's only real proxy and its
limits, and (2) states the validation criteria a real `ConfidenceEstimator` (roadmap Phase 2)
will need to satisfy before it can be trusted. Writing acceptance criteria before the module
exists is deliberate — it means Phase 2 has a concrete bar to clear instead of being validated
after the fact against whatever got built.

## What exists today: `completeness`

`computeEngine()` returns `completeness = answeredSubsTotal / ALL_SUB_IDS.length`
(`src/core-engine.js:281`) — the fraction of the 48 total sub-layers that were answered, out of
all of them, regardless of which layers or dimensions those subs belong to.

**Known limitations, stated plainly:**

- **Not evidence-weighted.** Two profiles with identical `completeness` can have very different
  actual evidentiary strength — e.g. 24 subs spread evenly across all 9 layers vs. 24 subs
  concentrated in `modulator` and `cognitive` alone. `completeness` cannot distinguish them.
- **Not coverage-balanced.** It doesn't reflect whether the *layers with the most weight*
  (`family` at 0.18, `modulator` at 0.15) are the ones actually answered, versus the least
  (`bio` at 0.08). A profile could have high `completeness` while its highest-weight layers are
  entirely unanswered.
- **Not consistency-aware.** Contradictory answers (flagged separately by `checkConsistency` /
  `NEUTRAL_EPSILON` in `scripts/consistency-check.js`, wired live into `src/server.js`) don't
  reduce `completeness` at all — a profile can be "complete" and self-contradictory
  simultaneously. Consistency and completeness are two independent, non-interacting signals
  today.
- **Invariant under weight perturbation.** Verified directly while building
  `scripts/sensitivity-analysis.js`: perturbing `LAYER_WEIGHTS` never changes `completeness`,
  because completeness is purely a function of which subs were answered, not of how those
  answers are weighted together. This is correct behavior for what `completeness` is, but it
  means `completeness` cannot serve as a stand-in for anything resembling "confidence in the
  weighting scheme's stability" — only "how much of the questionnaire was filled in."

**Where `completeness` is used as the Phase 1 confidence proxy:** both
`scripts/sensitivity-analysis.js` and the extended `scripts/ablate-layer-weights.js` report a
"Completeness Change" / "Completeness Variance" column, explicitly labeled as a proxy, per this
document. In `sensitivity-analysis.js` it is reported as always 0.00 (a verified invariant, not
an omission — see above). In `ablate-layer-weights.js` it is reinterpreted as a
**coverage-diversity** stat (stdev of `completeness` across golden profiles where a given layer
has ≥1 answered sub) — a real, non-trivial number about the profile sample, not a fabricated
drift-caused effect for a system that doesn't have one.

## Validation criteria for a future `ConfidenceEstimator` (Phase 2)

These are acceptance criteria to validate against once built — not a spec for what to build
(that's Phase 2's own design work), but the bar Phase 1 sets for it:

1. **Must strictly dominate `completeness` as a coverage signal.** For any two profiles where
   one's answered-sub set is a superset of the other's, the estimator's confidence must be
   ≥ the subset profile's — otherwise it's worse than the proxy it replaces.
2. **Must be sensitive to layer-weight-adjusted coverage**, not just raw sub count — answering
   all of `family` (0.18) should move confidence more than answering all of `bio` (0.08), all
   else equal. `completeness` fails this today by construction.
3. **Must incorporate consistency**, not just coverage — a profile flagged by
   `checkConsistency`/`NEUTRAL_EPSILON` should score measurably lower confidence than an
   equally-complete, internally-consistent one. `completeness` and consistency-checking are
   disconnected today; Phase 2 should connect them (this maps to the roadmap's own
   `ContradictionPenalty` module).
4. **Must be independently testable the same way `LAYER_WEIGHTS` is.** Whatever internal state
   the estimator uses must be exposed as a mutable object (not `const` primitives closed over
   internally), so a future `scripts/confidence-sensitivity.js` can perturb it the same way
   `scripts/sensitivity-analysis.js` perturbs `LAYER_WEIGHTS` — without needing source edits or
   reimplemented math, per this project's established diagnostic convention.
5. **Must produce a documented, defensible mapping from evidence to a bounded confidence value**
   (e.g. 0-100% or similar), with the same level of justification rigor `docs/WEIGHTS.md` and
   `weight-validation.md` already hold every weight constant to — no unexplained magic numbers.
6. **Must never silently gate scoring.** Per the roadmap's own Phase 12 principle ("never
   automatically overwrite weights... produce recommendations only"), low confidence should be
   *reported*, not used to suppress or auto-correct `finalVec`. Confidence and scoring are
   parallel outputs, not a scoring input.

Until a `ConfidenceEstimator` satisfying these criteria exists, `completeness` remains the
system's only real confidence-adjacent signal, and every report or doc in this repo that
mentions "confidence" for a profile should be understood as referring to this proxy, not a
validated estimate.
