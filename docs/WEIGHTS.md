# Weight & Dampener Inventory — `src/core-engine.js`

Read-only audit. Source: `src/core-engine.js` as of commit `02e3d49` (v6.7.0).

See also `docs/validation/` for the Phase 1 companion docs that validate *why* each value
below is defensible and *how sensitive* scoring is to it: `weight-validation.md`,
`layer-validation.md`, and `confidence-validation.md`. Generated sensitivity/contribution
numbers live in `docs/reports/` (`npm run sensitivity-analysis`, `npm run ablate-layer-weights`).

## (a) Cross-layer weights `W_ℓ`

| Symbol | Value | File:Line | Type | Tag | Justification |
|---|---|---|---|---|---|
| `LAYER_WEIGHTS.geo` | 0.10 | core-engine.js:14 | Constant | | |
| `LAYER_WEIGHTS.bio` | 0.08 | core-engine.js:14 | Constant | | |
| `LAYER_WEIGHTS.family` | 0.18 | core-engine.js:14 | Constant | | |
| `LAYER_WEIGHTS.culture` | 0.12 | core-engine.js:14 | Constant | | |
| `LAYER_WEIGHTS.social` | 0.12 | core-engine.js:15 | Constant | | |
| `LAYER_WEIGHTS.econ` | 0.14 | core-engine.js:15 | Constant | | |
| `LAYER_WEIGHTS.cognitive` | 0.11 | core-engine.js:15 | Constant | | |
| `LAYER_WEIGHTS.modulator` | 0.15 | core-engine.js:15 | Constant | | |
| `SUBACUTE_WEIGHT` (Tier S reserved slice) | 0.06 | core-engine.js:35 | Constant | construct-derived | Set below the smallest layer weight (0.08) because Tier S currently holds only 2 sub-layers versus bio's 6; documented as a stopgap pending v7 design per the code comment at core-engine.js:18-34. |
| `effectiveWeights[l]` (runtime, per-request) | `LAYER_WEIGHTS[l] * shrink` where `shrink = subacuteAnswered ? (1 - 0.06) : 1` | core-engine.js:252-255 | Computed | | |

Notes:
- The 8 `LAYER_WEIGHTS` values sum to 1.00 exactly; enforced by the test suite, not by the constant itself.
- `LAYER_WEIGHTS` is never mutated at runtime — the Tier‑S shrink produces a derived `effectiveWeights` object per call; the base constant is untouched (core-engine.js:24-25, 250).
- A `weight_config` Postgres table exists (versioned via `POST /v1/weights`) and is seeded from `LAYER_WEIGHTS` once at first boot (`server.js:26-30`) — but `computeEngine()` never reads from that table. It is disconnected from actual scoring; **config-loaded in name only**.
- `SUBACUTE_WEIGHT` is not part of `LAYER_WEIGHTS` and not part of the versioned `/v1/weights` config at all (comment, core-engine.js:9-12, 91).

## (b) Within-layer weights `w_i`

**None exist in `core-engine.js`.** Layer roll-up (`computeEngine`, core-engine.js:242-246) is a plain, unweighted arithmetic mean of each layer's answered sub-vectors (`sum / rollupVectors.length`) — every sub-layer within a layer counts as one equal slot (`w_i = 1/N` implicitly, not a stored coefficient).

The confidence-ceiling magnitudes referenced in `core-engine.js`'s comments (lines 49-53, 60-64) live in `BAF_Simulator_v6.html`, upstream of `core-engine.js`, as descriptive text in each sub-layer's `title` string — not as an enforced numeric clamp anywhere in code (no `Math.min`/ceiling check found in either file):

| Symbol | Value | File:Line | Type | Tag | Justification |
|---|---|---|---|---|---|
| `nutrition` confidence ceiling | 1.00 | BAF_Simulator_v6.html:216 | Constant (documented in `title` string only; not enforced in code) | construct-derived | Direction of adjustment (reduce from naive HIGH 1.50) is anchored in a specific methodological critique of Danziger, Levav & Avnaim-Pesso 2011 by Weinshall-Margel & Shapard 2011 and Glockner 2016, per BAF_Technical_Architecture.docx Section 3.2b.4. The specific magnitude (1.00 rather than any other reduced value) is an authored judgment call, not derived from a stated formula. |
| `temperament` confidence ceiling | 1.25 | BAF_Simulator_v6.html:224 | Constant (documented in `title` string only; not enforced in code) | construct-derived | Direction of adjustment (reduce from naive HIGH 1.50) is anchored in the twin-study vs. molecular-genetic heritability gap (Jang et al. 1996/1998 at 40-60% vs. Power & Pluess 2015 at 15-21%), per BAF_Technical_Architecture.docx Section 3.2b.4. The specific magnitude (1.25 rather than any other reduced value) is an authored judgment call, not derived from the cited studies. |
| `ace` confidence ceiling | 1.50 (title also notes "confidence-confirmed 1.00x" — i.e. not reduced from the raw HIGH-tier ceiling) | BAF_Simulator_v6.html:284 | Constant (documented in `title` string only; not enforced in code) | construct-derived | Retention at full 1.50 is anchored in Felitti et al. 1998 being independently verified as stronger than the paper's own citation implied, per BAF_Technical_Architecture.docx Section 3.2b.4 ("one of the best-replicated effects in the whole catalogue"). Unlike nutrition and temperament, no downward adjustment was warranted, so magnitude equals the naive tier baseline. |

## (c) Dampener strength `λ` and correlation coefficients `ρ_ℓk`

| Symbol | Value | File:Line | Type | Tag | Justification |
|---|---|---|---|---|---|
| Same-layer dampener fold (`CORRELATED_PAIRS`) | `['attachment_style', 'parenting']` | core-engine.js:124-126 | Constant (list) | axiomatic | Pair inclusion is a structural judgment by the catalogue author, per BAF_Technical_Architecture.docx Section 8e: "Two sub-layer pairs were flagged as knowingly overlapping since v6.1... Both risked double-counting." No citation to attachment theory (Bowlby/Ainsworth) or empirical correlation coefficient. The axiom accepted is that the catalogue author's structural read of construct overlap governs pair membership. |
| `SAME_LAYER_PAIR_WEIGHT` (same-layer dampener strength) | 0.5 per member (each counts at 50% within its folded slot) | core-engine.js:124 (constant), 138-139 (use) | Constant | axiomatic | Structural artifact of a symmetric 2-way pairwise average; equal weight per member is the null hypothesis in the absence of a directional prior distinguishing CORRELATED_PAIRS members. |
| `CROSS_LAYER_DISCOUNT` (cross-layer dampener `λ`) | 0.5 | core-engine.js:179 | Constant | axiomatic | 0.5 is the neutral symmetric prior in the absence of a measured ρ; provisional pending independent citation quantifying emotional_trauma × stability correlation. Explicitly flagged as not citation-derived at core-engine.js:150-178. |
| Cross-layer dampener pairs (`CROSS_LAYER_PAIRS`) | `['emotional_trauma', 'stability']` | core-engine.js:180-182 | Constant (list) | axiomatic | Same basis as CORRELATED_PAIRS: catalogue-author judgment about overlapping constructs, not a cited correlation. BAF_Technical_Architecture.docx Section 8f explicitly disclaims empirical rigor for the associated discount strength; the pair membership itself is on the same footing. |
| `applyCrossLayerDampener` scaling | `scaleVec(subScores[a], CROSS_LAYER_DISCOUNT)` / same for `b` | core-engine.js:195-196 | Computed | | |

Notes:
- There is **no continuous correlation coefficient `ρ_ℓk`** anywhere in this file. Both dampeners are binary/structural: a pair is either on a fixed list (fully dampened when both members are answered) or absent (undampened). No graduated correlation strength is modeled or estimated from data.
- The same-layer mechanism (`layerRollupVectors`, core-engine.js:132-148) now uses the named `SAME_LAYER_PAIR_WEIGHT` constant instead of an inline magic number — a behavior-neutral rename (0.5-per-member effect is unchanged), not a tunable value with any independent justification of its own.
- `CROSS_LAYER_DISCOUNT = 0.5` was explicitly chosen (comment, core-engine.js:165-174) to match what `SAME_LAYER_PAIR_WEIGHT` already does to each pair member, and is described in the comment as a "neutral, symmetric prior," not derived from any citation or effect-size estimate.
- Both mechanisms are all-or-nothing per pair: if only one member of a pair is answered, no dampening applies to either (core-engine.js:136-137, 194).

## (d) Threshold constants

| Symbol | Value | File:Line | Wired into scoring | Tag | Justification |
|---|---|---|---|---|---|
| `NEUTRAL_EPSILON` | 0.05 | scripts/consistency-check.js:15 | Yes — `checkConsistency` is imported and used live in `src/server.js:16` | undetermined | Comment at scripts/consistency-check.js:1-30 states 0.05 was chosen to match SIGNIFICANT_DELTA in scripts/compare-golden.js, described as "comfortably above noise, comfortably below signal." No quantified noise floor or signal size is provided anywhere in the repo. The stated rationale cross-references one round number to another rather than deriving from a measurement or principle. |

## (e) Informational-only staleness flags

| Symbol | Value | File:Line | Wired into scoring | Tag | Justification |
|---|---|---|---|---|---|
| `SUBACUTE_EXPIRY_DAYS` | 35 | core-engine.js:44 | a staleness threshold, not a weight; informational-only, does not affect `finalVec` | axiomatic | Midpoint of the documented 4-6 week re-prompt window; the axiom is that neither edge of the stated window has independent defense over the other, so the midpoint is the neutral choice. |
