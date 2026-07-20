# Weight Validation Framework

Phase 1 (Scientific Scoring) deliverable. Companion to `docs/WEIGHTS.md` (the read-only
inventory of every weight/dampener constant): where that document catalogues *what exists and
where*, this document validates *why each value is defensible and how sensitive scoring is to
it*. Justification/Evidence text below is carried forward from `docs/WEIGHTS.md` rather than
re-derived — this is a companion lens on the same audit, not a second independent one.

One entry per weight-like constant, 13 total (the same set `docs/WEIGHTS.md` sections (a)-(e)
catalogue as directly weight-shaped, excluding `CORRELATED_PAIRS`/`CROSS_LAYER_PAIRS`, which
are membership lists, not magnitudes).

Sensitivity numbers below are pulled from the generated reports, not restated independently —
if the reports change, re-run `npm run sensitivity-analysis` / `npm run ablate-layer-weights`
and update the numbers here to match.

---

## `LAYER_WEIGHTS.geo` — 0.10 (`core-engine.js:14`)

- **Purpose:** cross-layer weight for the `geo` domain (`terrain`, `climate`, `density`) in the final blend.
- **Expected Behaviour:** increasing it raises `finalVec`'s sensitivity to geo answers and proportionally shrinks every other layer's renormalized share; decreasing it does the reverse.
- **Sensitivity:** worst-case overall score change 0.1375 at -20%, 0.1184 at +20% (`docs/reports/sensitivity-analysis.md`). Second-most-sensitive-per-declared-weight layer after `bio`.
- **Justification:** no independent citation for the specific magnitude 0.10; positioned per `docs/WEIGHTS.md`'s inventory as one of the 8 constants that "sum to 1.00 exactly, enforced by the test suite, not by the constant itself."
- **Evidence:** none cited beyond the architecture doc's Section 3.2b layer allocation; not flagged construct-derived or axiomatic in `docs/WEIGHTS.md` (untagged).
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.bio` — 0.08 (`core-engine.js:14`)

- **Purpose:** cross-layer weight for the `bio` domain (`energy`, `health`, `age`, `nutrition`, `temperament`, `cognitive_style`).
- **Expected Behaviour:** same proportional mechanism as `geo`. Being the smallest declared weight (0.08), a fixed-percentage perturbation here produces the largest *relative* swing in its own weight, and — per `SUBACUTE_WEIGHT`'s own justification comment (`core-engine.js:30-34`) — was the reference point ("smaller than every existing layer weight, min is bio at 0.08") for setting `SUBACUTE_WEIGHT` conservatively.
- **Sensitivity:** worst-case overall score change 0.1973 at -20%, 0.1755 at +20% (`sensitivity-analysis.md`) — the single most sensitive of the 8 layers, consistent with it having the smallest declared weight (same layer average sub-count of 6, one of the largest, means a proportionally bigger swing per weight-point moved).
- **Justification:** no independent citation for the magnitude; smallest of the 8, referenced as the "floor" comparison point for `SUBACUTE_WEIGHT`.
- **Evidence:** none cited; untagged in `docs/WEIGHTS.md`.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.family` — 0.18 (`core-engine.js:14`)

- **Purpose:** cross-layer weight for the `family` domain (`parenting`, `birthorder`, `stability`, `attachment_style`, `past_failures`, `ace`) — the single largest declared layer weight.
- **Expected Behaviour:** same proportional mechanism. Also the layer containing both same-layer dampener pair members (`attachment_style`/`parenting`, via `CORRELATED_PAIRS`) and one member of the cross-layer dampener pair (`stability`, paired with `emotional_trauma` in `modulator`) — so its layer average is the most dampener-affected of the 8.
- **Sensitivity:** worst-case overall score change 0.1513 at -20%, 0.1346 at +20% (`sensitivity-analysis.md`); largest single per-layer contribution-change entries in the cross-layer propagation table (e.g. perturbing `family` itself shifts its own contribution by 0.1261, `modulator`'s by 0.0756).
- **Justification:** no independent citation for 0.18 itself; being the largest weight is consistent with `family` also holding the highest-ceiling, most-independently-verified sub-layer (`ace`, ceiling 1.50, "confidence-confirmed," per `docs/WEIGHTS.md` section (b)) though that ceiling is documentation-only, not enforced in code.
- **Evidence:** `ace`'s ceiling justification cites Felitti et al. 1998 (per `docs/WEIGHTS.md`), but that evidence supports the sub-layer's ceiling text, not the 0.18 layer weight itself — no evidence directly justifies the magnitude 0.18.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.culture` — 0.12 (`core-engine.js:14`)

- **Purpose:** cross-layer weight for the `culture` domain (`collectivism`, `tradition`) — smallest sub-layer count (2) of the 8.
- **Expected Behaviour:** same proportional mechanism.
- **Sensitivity:** worst-case overall score change 0.0242 at ±20% (`sensitivity-analysis.md`) — the least sensitive layer alongside `cognitive`, despite `culture` and `social` sharing the same declared weight (0.12); the difference comes from how each layer's own vectors happen to sit relative to the other layers' in the golden profile set, not from the weight magnitude alone.
- **Justification:** no independent citation for 0.12.
- **Evidence:** none cited; untagged.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.social` — 0.12 (`core-engine.js:15`)

- **Purpose:** cross-layer weight for the `social` domain (`density_net`, `digital_ratio`, `social_comparison`, `relationship_conflict`, `social_exclusion`, `loneliness`).
- **Expected Behaviour:** same proportional mechanism.
- **Sensitivity:** worst-case overall score change 0.0303 at ±20% (`sensitivity-analysis.md`).
- **Justification:** no independent citation for 0.12; `loneliness` was added in v6.5 specifically to close a gap in this domain's catalogue coverage (per `core-engine.js:66-72`), but that addition justifies the sub-layer's inclusion, not the layer's weight magnitude.
- **Evidence:** none directly justifying 0.12 itself.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.econ` — 0.14 (`core-engine.js:15`)

- **Purpose:** cross-layer weight for the `econ` domain (`current_stability`, `formative_scarcity`, `time_pressure`).
- **Expected Behaviour:** same proportional mechanism.
- **Sensitivity:** worst-case overall score change 0.0673 at -20%, 0.0626 at +20% (`sensitivity-analysis.md`) — above the 0.05 drift threshold despite a mid-sized declared weight and only 3 sub-layers, because those 3 subs carry a comparatively large layer-average swing per sub answered.
- **Justification:** no independent citation for 0.14; `CHANGELOG.md`'s v6.7.0 entry notes a "RT monotonicity fix in the `time_pressure` sub-layer," which affects that sub's own vector math, not this layer weight.
- **Evidence:** none directly justifying 0.14.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.cognitive` — 0.11 (`core-engine.js:15`)

- **Purpose:** cross-layer weight for the `cognitive` domain (`education`, `schema_flex`, `cognitive_overload`, `decision_fatigue`, `anchoring_framing`, `sunk_cost`, `availability_heuristic`, `info_overload`) — 8 sub-layers, second-largest sub-count of the 8 layers.
- **Expected Behaviour:** same proportional mechanism.
- **Sensitivity:** worst-case overall score change 0.0229 at -20%, 0.0221 at +20% (`sensitivity-analysis.md`) — the least sensitive layer despite its large sub-count, because its 8 sub-layer vectors' layer average sits closest to the other layers' in the golden profile set (a large N smooths a layer's average toward stability, independent of the layer weight itself).
- **Justification:** no independent citation for 0.11.
- **Evidence:** none directly justifying 0.11.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `LAYER_WEIGHTS.modulator` — 0.15 (`core-engine.js:15`)

- **Purpose:** cross-layer weight for the `modulator` domain (`ego`, `stress`, `sleep`, `dehydration`, `hormonal`, `substance_state`, `depression`, `fear_failure`, `emotional_trauma`, `anger_resentment`, `shame`, `core_values`) — 12 sub-layers, the single largest sub-count and second-largest declared weight.
- **Expected Behaviour:** same proportional mechanism. Holds the `emotional_trauma` member of the cross-layer dampener pair (paired with `family`'s `stability`).
- **Sensitivity:** worst-case overall score change 0.2243 at -20%, 0.2042 at +20% (`sensitivity-analysis.md`) — second-most sensitive layer overall, and dominates the dimension-change table (RT/SC ±0.2243, the largest single per-dimension swing of any layer at -20%).
- **Justification:** no independent citation for 0.15; large sub-count (12, largest of the 8) is a plausible structural rationale for a comparatively high weight, but this is inference, not a stated design rule anywhere in `core-engine.js` or `docs/WEIGHTS.md`.
- **Evidence:** none directly justifying 0.15.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `SUBACUTE_WEIGHT` — 0.06 (`core-engine.js:35`)

- **Purpose:** reserved-slice weight for Tier S (`subacute`: `grief`, `life_transitions`); applied as a proportional shrink `(1 - SUBACUTE_WEIGHT)` to the 8 core layers only when Tier S has ≥1 answered sub.
- **Expected Behaviour:** increasing it would raise Tier S's share of `finalVec` (when answered) and shrink all 8 core layers further; has zero effect on any profile where Tier S is unanswered (shrink = 1, identity).
- **Sensitivity:** **not independently testable via the current diagnostic scripts.** `SUBACUTE_WEIGHT` is a plain `const` primitive that `computeEngine()` closes over internally — mutating the exported copy (`engine.SUBACUTE_WEIGHT = x`) is a verified no-op on scoring (empirically confirmed while building `scripts/sensitivity-analysis.js`; see that script's header). Measuring its real sensitivity would require either a `core-engine.js` source change (exposing it as a mutable object property, mirroring `LAYER_WEIGHTS`) or reimplementing the shrink formula externally — the latter against this project's own "no scoring math is reimplemented here" convention. Flagged as a follow-up, not resolved in Phase 1.
- **Justification:** set below the smallest layer weight (`bio` at 0.08) because Tier S currently holds only 2 sub-layers (fewest of any layer) and is explicitly framed as a stopgap pending a "real" v7 design (`core-engine.js:18-34`).
- **Evidence:** none cited; explicitly axiomatic/conservative-default per `docs/WEIGHTS.md` (construct-derived tag), following the same "erring conservative on new/contested additions" pattern as the nutrition/temperament confidence-correction.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `SAME_LAYER_PAIR_WEIGHT` — 0.5 (`core-engine.js:124`)

- **Purpose:** fold weight (0.5 per member) applied when both `CORRELATED_PAIRS` members (`attachment_style`, `parenting`, both in `family`) are answered, so the pair occupies one slot in `family`'s layer average instead of two.
- **Expected Behaviour:** increasing it toward 1.0 per member would re-introduce the double-count this constant exists to prevent (two full-weight slots instead of one shared slot); decreasing it toward 0 would suppress the pair's combined contribution to `family`'s average entirely.
- **Sensitivity:** **not independently testable via the current diagnostic scripts** — same reason as `SUBACUTE_WEIGHT`: a `const` primitive closed over internally by `layerRollupVectors()`, confirmed via direct test that external mutation is a no-op on scoring.
- **Justification:** structural artifact of a symmetric 2-way pairwise average; equal weight per member is the null hypothesis absent a directional prior distinguishing the two members.
- **Evidence:** none — axiomatic per `docs/WEIGHTS.md`. Pair membership itself (not this weight) is grounded in the catalogue author's structural read of construct overlap, not a cited correlation coefficient for attachment theory (Bowlby/Ainsworth).
- **Last Modified:** `b6218e2` (2026-07-19) — behavior-neutral rename from an inline magic number to this named constant; the 0.5 magnitude itself is unchanged since introduction.
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `CROSS_LAYER_DISCOUNT` — 0.5 (`core-engine.js:180`)

- **Purpose:** discount factor applied to each member of a `CROSS_LAYER_PAIRS` pair (`emotional_trauma` in `modulator`, `stability` in `family`) when both are answered — the cross-layer generalization of `SAME_LAYER_PAIR_WEIGHT` for pairs that don't share a layer average to fold into.
- **Expected Behaviour:** increasing it toward 1.0 removes the double-count protection between the two layers; decreasing it toward 0 suppresses both members' contributions to their own layer averages when both are answered.
- **Sensitivity:** **not independently testable via the current diagnostic scripts** — same `const`-primitive constraint as above, confirmed via direct test.
- **Justification:** chosen to match what `SAME_LAYER_PAIR_WEIGHT` already does to each same-layer pair member (a straight 2-way average implies 50% each); the neutral, symmetric prior absent any independent citation quantifying how correlated `emotional_trauma` and `stability` actually are.
- **Evidence:** none — explicitly disclaimed as not citation-derived at `core-engine.js:150-178`; axiomatic per `docs/WEIGHTS.md`.
- **Last Modified:** `42948b4` (2026-07-13).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `NEUTRAL_EPSILON` — 0.05 (`scripts/consistency-check.js:15`)

- **Purpose:** neutrality threshold used by `checkConsistency` (wired live into `src/server.js:16`) to flag answers that contradict each other.
- **Expected Behaviour:** increasing it makes consistency checking more tolerant (fewer flagged contradictions); decreasing it makes it stricter (more flags). Does **not** feed `computeEngine()` or `finalVec` at all — it only affects the consistency-flag output, not scoring.
- **Sensitivity:** out of scope for `scripts/sensitivity-analysis.js` by design — that script measures drift in `computeEngine()`'s outputs (`finalVec`, layer contribution, completeness), none of which `NEUTRAL_EPSILON` can move. A meaningful sensitivity analysis for this constant would need a corpus of answer-pairs and would measure flag-rate change, not score drift — a different diagnostic than Phase 1 built, and a reasonable Phase 1 follow-up.
- **Justification:** chosen to match `SIGNIFICANT_DELTA` in `scripts/compare-golden.js`, described in that file's own comment as "comfortably above noise, comfortably below signal."
- **Evidence:** none quantified — the stated rationale cross-references one round number to another rather than deriving from a measurement; tagged "undetermined" in `docs/WEIGHTS.md`.
- **Last Modified:** `c0547b6` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `SUBACUTE_EXPIRY_DAYS` — 35 (`core-engine.js:44`)

- **Purpose:** staleness threshold (in days) for Tier S sub-layer answers (`grief`, `life_transitions`); flags `subacuteStale: true` in `computeEngine()`'s return value.
- **Expected Behaviour:** increasing it delays the staleness flag on old Tier S answers; decreasing it flags staleness sooner. Informational only — does **not** affect `finalVec` (Tier S's contribution is unchanged whether or not it's flagged stale).
- **Sensitivity:** out of scope for `scripts/sensitivity-analysis.js` by design, same reason as `NEUTRAL_EPSILON` — it never feeds `finalVec`. Its "sensitivity" is really a flag-rate question (how often would profiles cross the staleness boundary at 28 vs. 35 vs. 42 days), not a score-drift question; not measured in Phase 1.
- **Justification:** midpoint of the architecture doc's stated 4-6 week re-prompt window; the axiom is that neither edge of that window has independent defense over the other, so the midpoint is the neutral choice.
- **Evidence:** none quantified beyond the stated window itself; axiomatic per `docs/WEIGHTS.md`.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

---

## Summary: what Phase 1 sensitivity analysis actually covers

Of the 13 constants above, only the **8 `LAYER_WEIGHTS` entries** are independently
perturbable through the current diagnostic scripts (`scripts/sensitivity-analysis.js`,
`scripts/ablate-layer-weights.js`) without editing `src/core-engine.js` source. `SUBACUTE_WEIGHT`,
`SAME_LAYER_PAIR_WEIGHT`, and `CROSS_LAYER_DISCOUNT` are `const` primitives closed over
internally by `computeEngine()` — external mutation of their exported copies is a verified
no-op, confirmed empirically while building this framework. `NEUTRAL_EPSILON` and
`SUBACUTE_EXPIRY_DAYS` are threshold/flag constants that never feed `finalVec` at all, so a
score-drift sensitivity analysis is the wrong tool for them regardless.

Making the three `const`-primitive constants genuinely tunable (mirroring how `LAYER_WEIGHTS`
is already a mutable object) is a reasonable next step, but it's a `core-engine.js` source
change — a decision with its own weight, not bundled into this read-only-diagnostic phase.
