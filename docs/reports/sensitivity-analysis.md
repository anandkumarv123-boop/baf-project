# Weight Sensitivity Analysis

Generated 2026-07-20T08:14:27.018Z against engine v6.7.0. Perturbs each of the 8
`LAYER_WEIGHTS` entries at -20%/-10%/0%/+10%/+20% of its own value (rescaling the other 7
proportionally so the pool still sums to 1.00), re-scores every golden profile
(`scripts/golden-profiles.js`) via the real `computeEngine()`, and reports worst-case
(max across profiles) drift. Full per-profile detail: `sensitivity-analysis.json`.
Machine-readable summary: `sensitivity-analysis.csv`.

**Not perturbed here** (see script header for the full reasoning): `SUBACUTE_WEIGHT`,
`SAME_LAYER_PAIR_WEIGHT`, and `CROSS_LAYER_DISCOUNT` are `const` primitives that
`computeEngine()` closes over internally — mutating the exported copies is a verified
no-op on scoring, unlike `LAYER_WEIGHTS` (a mutable object). `NEUTRAL_EPSILON` never
feeds `computeEngine()` at all.

**Completeness (confidence proxy) change: always 0.00 across every perturbation below** —
completeness is driven by which sub-layers are answered, not by layer weights. Verified
invariant, not an omission. See `docs/validation/confidence-validation.md`.

## Overall Score Change (worst-case across golden profiles)

| Layer | -20% | -10% | 0% | 10% | 20% |
|---|---|---|---|---|---|
| geo (0.1) | 0.1375 ! | 0.0661 ! | 0.0000 | 0.0613 ! | 0.1184 ! |
| bio (0.08) | 0.1973 ! | 0.0957 ! | 0.0000 | 0.0902 ! | 0.1755 ! |
| family (0.18) | 0.1513 ! | 0.0734 ! | 0.0000 | 0.0692 ! | 0.1346 ! |
| culture (0.12) | 0.0242 | 0.0121 | 0.0000 | 0.0121 | 0.0242 |
| social (0.12) | 0.0303 | 0.0152 | 0.0000 | 0.0152 | 0.0303 |
| econ (0.14) | 0.0673 ! | 0.0330 | 0.0000 | 0.0318 | 0.0626 ! |
| cognitive (0.11) | 0.0229 | 0.0113 | 0.0000 | 0.0111 | 0.0221 |
| modulator (0.15) | 0.2243 ! | 0.1095 ! | 0.0000 | 0.1045 ! | 0.2042 ! |

18/40 perturbations exceed the 0.05 drift threshold (baseline 0% rows are trivially 0 and never flag).

## Dimension Change (worst-case per DIM, at the largest tested perturbation +/-20%)

| Layer | RT | SC | ER | AR | DS | SR | (at -20%) |
|---|---|---|---|---|---|---|---|
| geo | -0.1375 | +0.0743 | +0.0817 | -0.0817 | +0.0817 | -0.0956 | |
| bio | +0.1973 | +0.0129 | -0.0165 | -0.0038 | +0.0036 | +0.0325 | |
| family | -0.1513 | +0.1513 | -0.0504 | +0.0504 | -0.0504 | +0.0504 | |
| culture | +0.0171 | +0.0242 | -0.0159 | +0.0194 | -0.0057 | +0.0222 | |
| social | +0.0118 | -0.0303 | +0.0114 | -0.0078 | +0.0215 | -0.0050 | |
| econ | -0.0109 | -0.0330 | -0.0673 | -0.0279 | +0.0363 | +0.0572 | |
| cognitive | -0.0083 | +0.0059 | +0.0093 | -0.0108 | +0.0229 | -0.0119 | |
| modulator | +0.2243 | -0.2243 | -0.0401 | +0.0401 | -0.0401 | +0.0401 | |

## Layer Contribution Change (worst-case, at +/-20% — shows cross-layer propagation)

Perturbing one layer's weight changes every *other* layer's normalized contribution
share too (renormalization), even though no other layer's own vector moves. Rows =
perturbed layer, columns = which layer's contribution shifted, at the -20% delta.

| Perturbed \ Affected | geo | bio | family | culture | social | econ | cognitive | modulator | subacute |
|---|---|---|---|---|---|---|---|---|---|
| geo | 0.1110 | 0.0688 | 0.0446 | 0.0050 | 0.0050 | 0.0217 | 0.0046 | 0.0371 | 0.0423 |
| bio | 0.0661 | 0.0986 | 0.0053 | 0.0039 | 0.0039 | 0.0169 | 0.0036 | 0.0090 | 0.0325 |
| family | 0.0504 | 0.0073 | 0.1261 | 0.0099 | 0.0204 | 0.0360 | 0.0204 | 0.0756 | 0.0164 |
| culture | 0.0057 | 0.0046 | 0.0083 | 0.0451 | 0.0062 | 0.0072 | 0.0056 | 0.0074 | 0.0103 |
| social | 0.0057 | 0.0046 | 0.0178 | 0.0062 | 0.0487 | 0.0072 | 0.0125 | 0.0148 | 0.0103 |
| econ | 0.0204 | 0.0184 | 0.0354 | 0.0073 | 0.0073 | 0.0757 | 0.0067 | 0.0345 | 0.0123 |
| cognitive | 0.0052 | 0.0042 | 0.0161 | 0.0056 | 0.0113 | 0.0065 | 0.0491 | 0.0134 | 0.0094 |
| modulator | 0.0401 | 0.0200 | 0.0721 | 0.0080 | 0.0163 | 0.0349 | 0.0163 | 0.1121 | 0.0133 |

