# BAF Engine — Synthetic Pilot Results

**Generated:** 2026-07-12 (run against `src/core-engine.js`, current `main`)

## What this is — and isn't

**This is not human validation data.** The Human Validation & Enhanced Testing Protocol
calls for 500-1,000 *real* respondents, scenario responses, external ratings, passive
behavioral signals, and longitudinal tracking. None of that exists yet — no respondents
have been recruited and no `BAF_Questionnaire.docx` data has been collected.

What follows is **6 fabricated respondent archetypes**, written by hand to loosely follow
the protocol's structure (basic info, scenario-based decisions, current modulators), then
manually mapped into the engine's `precisionVectors` input format and scored through the
real `computeEngine`. This demonstrates that the engine produces plausible, differentiated
output for plausible input — it is a sanity check on the *math*, not evidence that the
engine predicts anything about real people. Treat every number below as illustrative only.

---

## Results

| Profile | Completeness | Layers | RT | SC | ER | AR | DS | SR | Top drivers |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Startup Founder** (34, tech) | 51.1% (24/47) | 8/9 | +0.269 | -0.360 | +0.357 | -0.220 | +0.309 | -0.326 | culture, econ, modulator |
| **Surgeon** (48, high-pressure OR) | 44.7% (21/47) | 6/9 | -0.087 | +0.354 | -0.046 | +0.246 | +0.564 | +0.450 | family, modulator, econ |
| **Police Officer** (29, urban patrol) | 42.6% (20/47) | 7/9 | -0.124 | +0.472 | +0.327 | +0.463 | -0.037 | -0.061 | culture, family, social |
| **Crypto/Day Trader** (26, self-employed) | 42.6% (20/47) | 6/9 | +0.726 | -0.363 | +0.776 | -0.323 | +0.323 | -0.670 | modulator, econ, geo |
| **Schoolteacher** (41, public school) | 42.6% (20/47) | 8/9 | -0.254 | +0.723 | +0.142 | +0.412 | -0.138 | +0.204 | family, culture, modulator |
| **Bankruptcy Survivor** (52, former owner) | 40.4% (19/47) | 8/9 | -0.805 | +0.283 | +0.814 | +0.099 | -0.357 | -0.945 | family, econ, modulator |

*Dimensions: RT = Risk Tolerance, SC = Social Conformity, ER = Emotional Reactivity,
AR = Authority Deference, DS = Independent Decision-Making, SR = Stress Resilience
(all on the engine's -2..2 scale).*

---

## Per-profile detail

### Startup Founder — 34, tech, India
**Scenario answers used to derive input:** market crash → Buy More · public blame →
argue then follow up later · friend loan request → ask questions · job loss → start
business · lost biggest client → pivot · spouse disagreement → discuss · windfall →
reinvest in business.

**Read:** Positive RT/DS, negative SC/AR — reads as an independent, moderately
risk-seeking decision-maker who doesn't defer to authority. Negative SR despite the
risk appetite reflects the burnout/sunk-cost/fear-of-failure modulators included (prior
business failure, constant deadline pressure) — resilience and risk tolerance aren't the
same axis in this model, and this profile shows them diverging as designed.

### Surgeon — 48, high-pressure OR
**Scenario answers:** market crash → hold · public blame → stay silent, speak later ·
friend loan → ask questions · job loss → upskill · lost client (analog) → reduce costs ·
spouse disagreement → discuss · police stop → cooperate · windfall → invest.

**Read:** High DS and SR, positive AR/SC — composed, independent-in-the-moment
decision-maker who still respects institutional hierarchy and protocol. This is the
clearest "trained crisis composure" signature of the six: low |ER|, high SR.

### Police Officer — 29, urban patrol
**Scenario answers:** market crash → hold · public blame → stay silent, address later ·
friend loan → refuse · job loss → apply immediately · lost client (analog) → reduce
costs · spouse disagreement → discuss · windfall → buy house.

**Read:** Highest AR and SC of the six — strong institutional/hierarchical deference and
norm-conformity, consistent with a command-structure profession. Near-zero DS/SR reflects
a mostly stability-and-procedure-oriented input set rather than either extreme.

### Crypto/Day Trader — 26, self-employed
**Scenario answers:** market crash → buy more · public blame → argue · friend loan →
partial · job loss → already self-employed, keeps trading · lost client (analog) →
ignore, stay the course · spouse disagreement → fight · windfall → reinvest in crypto/business.

**Read:** The most extreme profile of the six on every axis: highest RT and ER, most
negative SC/AR/SR. This is the input set designed to stress-test the "risk tolerance and
stress resilience are independent axes" property — high risk appetite paired with the
*lowest* stress resilience in the set, driven by volatility-linked modulators (sleep,
substance state, information overload, anchoring/availability bias).

### Schoolteacher — 41, public school
**Scenario answers:** market crash → sell half · public blame → stay silent, speak later
· friend loan → partial · job loss → upskill · lost client (analog) → reduce costs ·
spouse disagreement → compromise · police stop → cooperate · windfall → donate + invest.

**Read:** Highest SC in the set, negative RT — a conformity/community/tradition-weighted
input produces the most norm-aligned, risk-averse output of the six, as intended.

### Bankruptcy Survivor — 52, former business owner
**Scenario answers:** market crash → sell everything · public blame → stay silent ·
friend loan → refuse · job loss → apply immediately · lost client (past event, now
cautious) → closed the business · spouse disagreement → delay · windfall → save/invest
conservatively.

**Read:** The most negative RT and SR in the set, driven by heavy family/econ/modulator
loading (past failures, fear of failure, depression, shame, a fresh Tier-S
`life_transitions` entry). This profile exercises the Tier-S reserved-slice weighting
path (the other five don't touch Tier S), and `family`/`econ` dominate the top-drivers
list exactly as the input was designed to produce — a strong, coherent "post-crisis
caution" signature.

---

## What this pilot does and doesn't show

**Shows:** the engine responds to structured input the way its documented weighting and
axis design intends — archetypes with different scenario answers and modulator loads
produce visibly different, internally coherent score vectors, and features like the
Tier-S reserved slice and the RT/SR independence exercise correctly under realistic
(not just boundary/random) input.

**Doesn't show:** whether any of this corresponds to how a real founder, surgeon, police
officer, trader, teacher, or bankruptcy survivor would actually score, self-report, or
behave. That requires the real Section 1-17 data collection this protocol describes —
including external validation (Section 12), passive signals (Section 13), and
longitudinal tracking (Section 15) — none of which a hand-written synthetic profile can
substitute for.
