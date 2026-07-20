# Layer Validation Framework

Phase 1 (Scientific Scoring) deliverable. Companion to `docs/validation/weight-validation.md`
(which validates individual weight constants) — this document validates the 9 roll-up layers
themselves (`ALL_LAYER_IDS` = the 8 `LAYER_WEIGHTS` layers + Tier S `subacute`): their
composition, their expected behavioral role, and their measured sensitivity/contribution, per
`docs/reports/layer-contribution.md` and `docs/reports/sensitivity-analysis.md`.

A layer's own vector (`layerVecs[l]`, the plain arithmetic mean of its answered sub-layers) is
**independent of `LAYER_WEIGHTS`** — perturbing a layer's weight never changes what that layer
itself measures, only how much of `finalVec` it accounts for. "Sensitivity" below is about the
latter; a layer's own internal composition (which subs feed its mean) is a separate, largely
qualitative judgment call documented in `core-engine.js`'s comments and carried forward here.

---

## `geo` — 3 sub-layers

- **Members:** `terrain`, `climate`, `density`.
- **Purpose:** captures the physical/environmental domain of the architecture doc's 8-domain catalogue (Section 3.2b.1).
- **Expected Behaviour:** no single documented directional claim beyond "contributes proportionally to whichever DIMs its answered subs' vectors touch." Measured average lean (below) is empirical, not a designed target.
- **Avg Weight Share (baseline):** 0.2590 vs. declared weight 0.10 — geo's *measured* average contribution share across golden profiles is well above its declared weight, because the golden profile set includes several geo-heavy/single-layer profiles (e.g. `single-layer-geo-only`) that push its sample-average share up; this is a property of the profile sample, not evidence the weight itself is miscalibrated.
- **Dimension Lean:** RT (+0.2594) dominates; SC/ER/SR are secondary and roughly comparable.
- **Sensitivity:** worst-case overall score change 0.1375 (-20%) / 0.1184 (+20%) — 2nd-most sensitive of the 8. See `docs/validation/weight-validation.md#layer_weightsgeo--010-core-enginejs14`.
- **Justification:** membership (terrain/climate/density under "geo") is a structural/domain grouping from the architecture doc's catalogue, not independently justified per-sub here.
- **Evidence:** none cited for this layer's composition specifically.
- **Last Modified:** `66a7c6e` (2026-07-12) — `LAYER_WEIGHTS`/`SUB_TO_LAYER` block.
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `bio` — 6 sub-layers

- **Members:** `energy`, `health`, `age`, `nutrition`, `temperament`, `cognitive_style`.
- **Purpose:** biological/physiological domain.
- **Expected Behaviour:** same caveat as `geo`. Holds two of the three sub-layers with a documented (text-only, unenforced) confidence ceiling — `nutrition` (1.00) and `temperament` (1.25) — both explicitly *reduced* from the naive HIGH tier ceiling of 1.50 per `docs/WEIGHTS.md` section (b).
- **Avg Weight Share (baseline):** 0.1256 vs. declared weight 0.08.
- **Dimension Lean:** RT (-0.0911, the only layer among the 8 with a *negative* dominant lean) is the strongest; others are small and mixed-sign.
- **Sensitivity:** worst-case overall score change 0.1973 (-20%) / 0.1755 (+20%) at the ±20% scale, and 0.2505/0.2163 at the raw ±0.02 ablation scale (`ablate-layer-weights.js`) — **the single most sensitive layer of the 8** in both diagnostics, consistent with having the smallest declared weight (0.08).
- **Justification:** `nutrition`'s ceiling reduction is anchored in a specific methodological critique of Danziger, Levav & Avnaim-Pesso 2011 by Weinshall-Margel & Shapard 2011 and Glockner 2016 (per `docs/WEIGHTS.md`); `temperament`'s reduction is anchored in the twin-study vs. molecular-genetic heritability gap (Jang et al. 1996/1998 vs. Power & Pluess 2015). Both magnitudes (1.00, 1.25) are themselves authored judgment calls, not derived from a stated formula — and neither ceiling is enforced in code regardless (documentation text only).
- **Evidence:** see citations above, carried from `docs/WEIGHTS.md` section (b). This is evidence for the two sub-layers' *ceiling text*, not for `bio`'s own layer weight (0.08), which has no independent citation.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `family` — 6 sub-layers

- **Members:** `parenting`, `birthorder`, `stability`, `attachment_style`, `past_failures`, `ace`.
- **Purpose:** family-of-origin domain; largest declared layer weight (0.18) of the 8.
- **Expected Behaviour:** same caveat as `geo`. Contains **both** dampener mechanisms in this codebase: the same-layer fold (`attachment_style`+`parenting`, via `SAME_LAYER_PAIR_WEIGHT`) and one member of the cross-layer discount (`stability`, paired with `modulator`'s `emotional_trauma` via `CROSS_LAYER_DISCOUNT`) — so `family`'s layer average is the most dampener-affected of the 8, and its downstream contribution reflects that even though the dampeners' own strength constants aren't independently perturbable (see `weight-validation.md`).
- **Avg Weight Share (baseline):** 0.2376 vs. declared weight 0.18 — the closest baseline-share-to-declared-weight ratio of the 8 layers.
- **Dimension Lean:** ER (+0.2340) dominates, with SR (-0.1517) as the largest-magnitude negative lean of any layer.
- **Sensitivity:** worst-case overall score change 0.1513 (-20%) / 0.1346 (+20%) — 3rd-most sensitive; also produces the largest single entry in the cross-layer contribution-propagation table (perturbing `family` shifts `modulator`'s contribution by 0.0756, the largest cross-layer propagation of any pair in the table).
- **Justification:** `ace`'s retention at full 1.50 ceiling (not reduced, unlike `nutrition`/`temperament`) is anchored in Felitti et al. 1998 being independently verified as stronger than the paper's own citation implied ("one of the best-replicated effects in the whole catalogue," per `docs/WEIGHTS.md`). The same-layer pair (`attachment_style`/`parenting`) and cross-layer pair (`stability`) are both catalogue-author structural judgments about construct overlap, not cited correlation coefficients from attachment theory.
- **Evidence:** Felitti et al. 1998 (ACEs) for `ace`'s ceiling — again, evidence for a sub-layer ceiling, not for `family`'s 0.18 layer weight, which has no independent citation.
- **Last Modified:** `66a7c6e` (2026-07-12); dampener additions at `b6218e2` (2026-07-19, same-layer weight naming) and `42948b4` (2026-07-13, cross-layer discount).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `culture` — 2 sub-layers

- **Members:** `collectivism`, `tradition`.
- **Purpose:** cultural-context domain; smallest sub-layer count of the 8 (tied with Tier S).
- **Expected Behaviour:** same caveat as `geo`.
- **Avg Weight Share (baseline):** 0.1142 vs. declared weight 0.12 — closest-to-declared-weight ratio among the least-sensitive layers.
- **Dimension Lean:** DS (+0.0748) mildly dominant; all dimensions comparatively small and positive.
- **Sensitivity:** worst-case overall score change 0.0242 at ±20% — tied for least sensitive of the 8, alongside `cognitive`.
- **Justification:** membership is a structural/domain grouping; no per-sub justification beyond catalogue placement.
- **Evidence:** none cited for this layer specifically.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `social` — 6 sub-layers

- **Members:** `density_net`, `digital_ratio`, `social_comparison`, `relationship_conflict`, `social_exclusion`, `loneliness`.
- **Purpose:** social/relational domain.
- **Expected Behaviour:** same caveat as `geo`.
- **Avg Weight Share (baseline):** 0.1273 vs. declared weight 0.12 — very close alignment.
- **Dimension Lean:** SC (+0.0743) mildly dominant.
- **Sensitivity:** worst-case overall score change 0.0303 at ±20% — 3rd-least sensitive.
- **Justification:** `loneliness` was added in v6.5 specifically to close a gap identified in the v6.5 catalogue audit (Architecture 3.2b.1 Domain 2) — a documented rationale for that one sub's *inclusion*, not for the layer's 0.12 weight.
- **Evidence:** Cacioppo & Patrick 2008 (loneliness/social isolation) cited for `loneliness`'s inclusion — described in `core-engine.js` as having "a large physiological evidence base, no single quantifiable behavioral effect size."
- **Last Modified:** `66a7c6e` (2026-07-12); `loneliness` addition dated to the v6.5 catalogue audit (same file, no separate commit isolated in this repo's history for that sub specifically).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `econ` — 3 sub-layers

- **Members:** `current_stability`, `formative_scarcity`, `time_pressure`.
- **Purpose:** economic-context domain.
- **Expected Behaviour:** same caveat as `geo`.
- **Avg Weight Share (baseline):** 0.1752 vs. declared weight 0.14 — one of the larger baseline-share-over-declared-weight gaps, alongside `geo`.
- **Dimension Lean:** ER (+0.1398) dominant, with AR (+0.0923) as a secondary lean.
- **Sensitivity:** worst-case overall score change 0.0673 (-20%) / 0.0626 (+20%) — exceeds the 0.05 drift threshold despite only 3 sub-layers and a mid-sized declared weight.
- **Justification:** `CHANGELOG.md`'s v6.7.0 entry notes a "RT monotonicity fix in the `time_pressure` sub-layer" — a correctness fix to that sub's own vector math, not a justification for `econ`'s 0.14 layer weight.
- **Evidence:** none cited for the layer weight itself.
- **Last Modified:** `66a7c6e` (2026-07-12); `time_pressure` monotonicity fix at `d0475e6`-era v6.7.0 work (see `CHANGELOG.md`).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `cognitive` — 8 sub-layers

- **Members:** `education`, `schema_flex`, `cognitive_overload`, `decision_fatigue`, `anchoring_framing`, `sunk_cost`, `availability_heuristic`, `info_overload`.
- **Purpose:** cognitive-bias/load domain; 2nd-largest sub-count of the 8.
- **Expected Behaviour:** same caveat as `geo`. A large sub-count tends to smooth a layer's own average toward stability across the golden profile set, independent of its declared weight.
- **Avg Weight Share (baseline):** 0.1167 vs. declared weight 0.11 — very close alignment.
- **Dimension Lean:** ER (+0.0514) and AR (+0.0459) roughly comparable; no strongly dominant single dimension.
- **Sensitivity:** worst-case overall score change 0.0229 (-20%) / 0.0221 (+20%) — **least sensitive layer of the 8**, despite (or arguably because of) its large sub-count.
- **Justification:** membership is a structural/domain grouping (8 of the architecture doc's cognitive-bias entries); no per-sub justification beyond catalogue placement documented here.
- **Evidence:** none cited for this layer specifically.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `modulator` — 12 sub-layers

- **Members:** `ego`, `stress`, `sleep`, `dehydration`, `hormonal`, `substance_state`, `depression`, `fear_failure`, `emotional_trauma`, `anger_resentment`, `shame`, `core_values`.
- **Purpose:** state-modulation domain; largest sub-count (12) and 2nd-largest declared weight (0.15) of the 8. Holds the `emotional_trauma` member of the cross-layer dampener pair (paired with `family`'s `stability`).
- **Expected Behaviour:** same caveat as `geo`.
- **Avg Weight Share (baseline):** 0.2903 vs. declared weight 0.15 — the largest baseline-share-over-declared-weight gap of any layer, driven by its large sub-count.
- **Dimension Lean:** ER (+0.3597) strongly dominant, with SR (-0.2981) the largest-magnitude negative lean of any layer's average contribution, and RT (-0.1522) also notably negative.
- **Sensitivity:** worst-case overall score change 0.2243 (-20%) / 0.2042 (+20%) — 2nd-most sensitive layer, and produces the largest single per-dimension worst-case change of any layer (RT/SC at ±0.2243 at -20%).
- **Justification:** large sub-count (12, largest of the 8) is a plausible structural rationale for its comparatively high weight, but this is inference — not a stated design rule anywhere in `core-engine.js` or `docs/WEIGHTS.md`. The cross-layer dampener pairing (`emotional_trauma`/`stability`) is a catalogue-author structural judgment, explicitly disclaimed as not citation-derived.
- **Evidence:** none cited for the layer weight itself; the dampener pairing's discount strength (`CROSS_LAYER_DISCOUNT`) is explicitly a "neutral, symmetric prior," not evidence-derived.
- **Last Modified:** `66a7c6e` (2026-07-12); cross-layer dampener addition at `42948b4` (2026-07-13).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).

## `subacute` (Tier S) — 2 sub-layers

- **Members:** `grief`, `life_transitions`.
- **Purpose:** the only layer **not** part of `LAYER_WEIGHTS`; modeled as a reserved slice (`SUBACUTE_WEIGHT` = 0.06) applied as a proportional shrink to the 8 core layers only when Tier S has ≥1 answered sub. Introduced in v6.2 for inputs that resolve over weeks-months (grief, major life transitions) — too slow for `modulator` (re-assessed every run), too transient to treat as structural.
- **Expected Behaviour:** when unanswered, contributes nothing and the shrink factor is exactly 1 (the 8 layers reproduce their pre-Tier-S proportions exactly — an identity, not an approximation). When answered, carries its full undiluted 0.06 share rather than diluting/being diluted inside the 8-layer renormalization pool.
- **Avg Weight Share (baseline):** not applicable in the same sense as the 8 core layers — Tier S only appears at all in the 3 golden profiles where it's answered (`tier-s-only-grief`, `tier-s-only-both-fresh`, `tier-s-stale-plus-full`), each contributing exactly `SUBACUTE_WEIGHT` = 0.06 by construction whenever answered (not renormalized against the other layers the way core layers are).
- **Sensitivity:** **not independently testable via the current diagnostic scripts** — `SUBACUTE_WEIGHT` is a `const` primitive closed over internally by `computeEngine()`; see `weight-validation.md`'s entry for the full explanation and the empirical no-op confirmation.
- **Justification:** also carries a staleness flag (`SUBACUTE_EXPIRY_DAYS` = 35 days, informational only — does not exclude the sub-layer from `finalVec` even when stale, mirroring how "Partial — low confidence" completeness is a label, not a scoring exclusion).
- **Evidence:** none quantified for the 0.06 magnitude or the 35-day window; both are axiomatic per `docs/WEIGHTS.md`, chosen conservatively (smaller than every core layer weight) pending a "real" v7 design.
- **Last Modified:** `66a7c6e` (2026-07-12).
- **Owner:** Anand Kumar V (`anandkumarv123@gmail.com`).
