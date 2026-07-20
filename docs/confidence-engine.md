# Confidence Engine — `src/confidence/`

Phase 2 of the BAF v2.0 roadmap ("every prediction must include uncertainty"). Adds a
per-dimension confidence envelope alongside the existing scoring engine
(`src/core-engine.js`), without modifying it or anything it imports. Golden-profile drift is
0/15 by construction (see `npm run compare-golden`) — nothing about `finalVec` changes.

Builds directly on findings from Phase 1 (`docs/validation/confidence-validation.md`): no
confidence engine existed before this — only a naive `completeness`-threshold string
(`src/server.js`'s old `confidence` field: `'High'/'Moderate'/'Partial — low confidence'`) and
an unrelated scenario-agreement number inside `checkConsistency`'s per-dimension output
(`scripts/consistency-check.js`). Both are untouched; this is additive.

## Why per-dimension, not a single profile-level number

The engine's only real dimensions are `RT/SC/ER/AR/DS/SR` (`src/core-engine.js`'s `DIMS`).
Every answered sub-layer contributes a full 6-dim vector — there is no way to answer "only
RT" — so a naive coverage/confidence number computed per *layer* would be identical across
all 6 dimensions, a repeated constant rather than a real signal. Every module below
differentiates *which dimensions a layer's answered subs actually carry non-negligible signal
on*, using a "touch" test (see Coverage Methodology) rather than a flat answered/unanswered
count.

## Algorithm per module

### `EvidenceCoverage.js`
For each dimension `k` and layer `l`: `touchFraction_k(l)` = (subs in `l` whose answered value
at `k` exceeds `config.neutralEpsilon` in magnitude) / (l's **total** sub count — not just
answered). This is aggregated across `ALL_LAYER_IDS` using `core-engine.js`'s own
`effectiveWeights` formula (`LAYER_WEIGHTS[l] * shrink`, Tier S shrink applied only when
answered) **without** the answered-only renormalization step `computeEngine()` applies before
blending into `finalVec`. That's a deliberate divergence from how `finalVec` itself is
computed — see Coverage Methodology below for why.

### `ContradictionAnalyzer.js`
Reads `CORRELATED_PAIRS` (`attachment_style`/`parenting`) and `CROSS_LAYER_PAIRS`
(`emotional_trauma`/`stability`) directly from `core-engine.js` — the same pairs the engine
already dampens. For each pair where both members are answered, measures raw (pre-dampener)
divergence per dimension: `|a[k] - b[k]| / 4 * 100` (4 = the max possible difference between
two values on the -2..2 clamp). A pair is flagged as a `conflict` once its largest-dimension
divergence crosses `config.contradiction.flagThreshold` (default 50).

### `EvidenceStrength.js`
Pure function `strengthOf({coverage, consistency, contradictions})` → one of 5 buckets. Not an
independent per-sub evidence audit (see Rationale below) — it buckets the same weighted
composite `ConfidenceEstimator` computes for `confidence`, via
`config.evidenceStrength.thresholds`.

### `ConfidenceEstimator.js`
Computes `consistency_k` inline (population stdev of all answered-and-touching subs' values
at dimension `k`, across every layer — not just the two dampener pairs — normalized against
`config.consistency.maxSpread`), calls `EvidenceCoverage` and `ContradictionAnalyzer`, and
combines all three into the composite confidence score. Deliberately excludes `reliability`
(see Reliability note below).

### `ConfidenceReport.js`
Assembles the final per-dimension envelope: `{score, confidence, evidenceStrength,
evidenceCoverage, contradictionPenalty, metadata}` per `DIMS` key. `score` is
`engineResult.finalVec[k]` verbatim.

## Confidence calculation walkthrough (worked example)

Fixture: `tests/confidence/fixtures/perfect-dataset.json` — all 48 sub-layers answered with an
identical vector `{RT:1,SC:1,ER:1,AR:1,DS:1,SR:1}`, including both dampener pairs matching
each other (no contradiction).

1. **Coverage**: every layer is fully answered, so every `touchFraction_k(l) = 1`. Aggregated
   effective weights sum to exactly 1.0 across `ALL_LAYER_IDS` by construction →
   `coverage_RT = 100`.
2. **Consistency**: every touching sub at RT has the identical value `1` → stdev = 0 →
   `consistency_RT = 100 * (1 - 0/2) = 100`.
3. **Contradiction**: both dampener pairs match exactly → divergence 0 → `contradictionPenalty_RT = 0`.
4. **Confidence**: `100*0.5 + 100*0.3 - 0*0.4 = 80`.
5. **Evidence strength**: 80 is at the `strong` threshold boundary (`< 80` is `Strong`; `80`
   itself falls through to `Very Strong`) → `Very Strong`.

Contrast with `tests/confidence/fixtures/missing-data.json` (only 3 of `bio`'s 6 subs
answered, `bio`'s declared weight is 0.08): `touchFraction_RT(bio) = 3/6 = 0.5`, no other layer
answered → `coverage_RT = 0.08 * 0.5 * 100 = 4`. Low coverage correctly drags `confidence` down
to `4*0.5 + 100*0.3 - 0*0.4 = 32` (`Weak`), even though the 3 answered subs perfectly agree
with each other (`consistency_RT = 100`).

## Coverage methodology

`EvidenceCoverage` deliberately does **not** renormalize by only the answered layers' weight
share the way `computeEngine()` does before blending into `finalVec`. That renormalization is
correct for scoring (a single fully-answered layer should still produce a meaningful
`finalVec`), but it is the wrong behavior for a *coverage* signal: it would make a profile
that fully answers one small layer (e.g. `culture`, weight 0.12) and nothing else show ~100%
coverage, identical to a profile that answered all 48 sub-layers. `EvidenceCoverage` instead
weights every layer — answered or not — by its full declared `effectiveWeights` share, so an
entirely unanswered layer keeps dragging coverage down by its true weight, not vanishing from
the denominator. `tests/confidence/EvidenceCoverage.test.js`'s TC3/TC4 are the regression test
for this specific behavior.

## EvidenceStrength thresholds and rationale

Default thresholds (`config/confidenceConfig.js`): `veryWeak: 20, weak: 40, moderate: 60,
strong: 80` — even 20-point bands over the composite's 0-100 range. This is a stated default,
not evidence-derived, on the same footing as `core-engine.js`'s `SUBACUTE_WEIGHT` or
`CROSS_LAYER_DISCOUNT` (Phase 1, `docs/validation/weight-validation.md`): a principled,
documented, **tunable** judgment call rather than an unexplained magic number. Weights
(`coverage: 0.5, consistency: 0.3, contradiction: 0.4`) don't need to sum to 1 — the
`compositeOf()` clamp absorbs any over/undershoot — but were chosen so a fully-covered,
fully-consistent profile lands at exactly 80 (the `strong`/`very strong` boundary) before any
contradiction penalty, leaving room for contradictions to pull a profile down without an
unreachable ceiling.

**Explicitly rejected alternative design** (documented so it isn't quietly reconsidered later
without re-deriving why): building `EvidenceStrength` from a per-sub-layer *cited-evidence*
lookup — e.g. only `nutrition`/`temperament`/`ace`/`loneliness` have any citation documented
anywhere in this repo (`docs/WEIGHTS.md`, `core-engine.js` comments), so 44 of 48 subs would
be "uncited" by construction. That would have resurrected exactly the problem
`CHANGELOG.md`'s v6.7.0 entry already fixed once (removing "unenforced... undefendable
provenance" tier-ceiling numbers). `EvidenceStrength` instead buckets the same composite
`confidence` uses — "confidence, categorized" — so there is exactly one number being
justified, not two that could silently diverge.

## ContradictionAnalyzer's dampener-aware design

`ContradictionAnalyzer` only looks at the two pairs `core-engine.js` itself already flags as
knowingly overlapping (`CORRELATED_PAIRS`, `CROSS_LAYER_PAIRS`) — not a general anomaly
detector across all 48 subs ("divergence within unrelated pairs → normal, no flag", per spec).
The rationale: the engine already asserts these specific pairs measure overlapping
constructs (well-documented in `core-engine.js`'s own comments, e.g. "knowingly overlapping
since v6.1... both risked double-counting"). If two subs the engine treats as substantially
redundant disagree sharply in a respondent's raw answers, that disagreement is itself
diagnostic — either the respondent's answers are internally inconsistent, or the overlap
assumption doesn't hold well for this particular profile — and is a stronger, better-founded
signal than measuring divergence between arbitrary unrelated sub pairs, which have no such
prior linking them.

This is a distinct signal from `scripts/consistency-check.js`'s `checkConsistency()`, which
compares an already-computed `finalVec` against **external** scenario-bank answers. No data
source or computation overlaps between the two; `ContradictionAnalyzer` never touches
`scripts/scenario-bank.js` or `scripts/consistency-check.js`.

## Reliability — deferred to Phase 3

The per-dimension envelope has no `reliability` field, not even as `null`. Reliability (in the
test-retest sense — does the same respondent produce a similar profile across multiple
submissions) requires a multi-submission data model this phase does not have: `src/store.js`
currently stores each profile independently with no link back to a prior submission by the
same respondent. Building that link (and deciding what "the same respondent" even means under
this project's privacy posture — see `scripts/scenario-bank.js`'s own note on the deliberately
unimplemented external-rater flow) is its own piece of design work, not a stub to bolt on
here. Adding a placeholder field now would either be permanently `null` (dead weight) or
implicitly commit to a future shape before that design work happens — worse than waiting.

## Future calibration strategy

Every default in `config/confidenceConfig.js` is a stated judgment call, not derived from
outcome data — there is no ground-truth "was this profile's confidence justified in
hindsight" dataset yet. Per the roadmap's own Phase 12 (Learning Engine) principle — "never
automatically overwrite weights... produce recommendations only" — any future calibration
against real outcomes should follow the same pattern already used for `LAYER_WEIGHTS` in
Phase 1: a read-only diagnostic script (analogous to `scripts/sensitivity-analysis.js`) that
reports how `confidence`/`evidenceStrength` would have shifted under different
`confidenceConfig.js` values against a corpus of resolved profiles, informing a human decision
to update the config — never an automatic overwrite. `config/confidenceConfig.js` being a
plain mutable object (not `const` primitives) is what makes that kind of diagnostic possible
at all, mirroring exactly the lesson Phase 1 drew from `core-engine.js`'s `SUBACUTE_WEIGHT`.
