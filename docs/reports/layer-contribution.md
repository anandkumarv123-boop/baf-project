# Layer Importance Report

Generated 2026-07-20T08:14:26.027Z against engine v6.7.0.
Read-only diagnostic -- informs how LAYER_WEIGHTS is tagged in docs/WEIGHTS.md; not
wired into npm test. See script header for full methodology.

## Ablation Drift (+/-0.02 absolute perturbation, worst-case across golden profiles)

| Layer | δ=-0.02 worst drift | δ=+0.02 worst drift | Score Variance |
|---|---|---|---|
| geo | 0.1375 ! | 0.1184 ! | 0.0001 |
| bio | 0.2505 ! | 0.2163 ! | 0.0003 |
| family | 0.0818 ! | 0.0767 ! | 0.0000 |
| culture | 0.0202 | 0.0202 | 0.0000 |
| social | 0.0253 | 0.0253 | 0.0000 |
| econ | 0.0476 | 0.0451 | 0.0000 |
| cognitive | 0.0207 | 0.0201 | 0.0000 |
| modulator | 0.1471 ! | 0.1382 ! | 0.0000 |

8/16 perturbations exceed the 0.05 drift threshold.
Score Variance = population variance of the two worst-drift numbers per layer -- a
spread stat alongside the max; with only 2 samples it mostly tracks how asymmetric
the +/- response is (renormalization is not perfectly linear).

## Layer Contribution & Dimension Contribution (baseline, unperturbed)

`Avg Weight Share` = each layer's average normalized contribution weight (normW)
across golden profiles where it's answered -- independent of the ablation above.
`Dimension Lean` = that layer's average actual contribution vector (normW *
layerVecs[l]); the dimension(s) with the largest magnitude are what this layer
mostly drives in a typical answered profile.

| Layer | Declared Weight | Avg Weight Share | RT | SC | ER | AR | DS | SR |
|---|---|---|---|---|---|---|---|---|
| geo | 0.1 | 0.2590 | +0.2594 | +0.0880 | +0.1107 | -0.0134 | +0.0299 | +0.0887 |
| bio | 0.08 | 0.1256 | -0.0911 | +0.0218 | +0.0382 | +0.0336 | +0.0152 | -0.0029 |
| family | 0.18 | 0.2376 | +0.0927 | -0.0323 | +0.2340 | -0.0332 | +0.0947 | -0.1517 |
| culture | 0.12 | 0.1142 | +0.0522 | +0.0177 | +0.0587 | +0.0189 | +0.0748 | +0.0248 |
| social | 0.12 | 0.1273 | +0.0216 | +0.0743 | +0.0617 | +0.0530 | +0.0183 | +0.0191 |
| econ | 0.14 | 0.1752 | -0.0026 | +0.0876 | +0.1398 | +0.0923 | -0.0304 | -0.0567 |
| cognitive | 0.11 | 0.1167 | +0.0241 | +0.0440 | +0.0514 | +0.0459 | +0.0148 | +0.0213 |
| modulator | 0.15 | 0.2903 | -0.1522 | +0.2007 | +0.3597 | +0.0652 | -0.0303 | -0.2981 |

## Completeness Variance (confidence-proxy coverage stat, baseline, unperturbed)

Stdev of `completeness` across the golden profiles where that layer has >=1 answered
sub -- a coverage-diversity stat about the profile sample, NOT a drift-caused effect.
Perturbing a layer's weight never changes completeness (see
scripts/sensitivity-analysis.js), so a drift-based version of this stat is always
zero by construction; this is the honest, non-trivial version instead. See
docs/validation/confidence-validation.md for why completeness is used as the
confidence proxy today.

| Layer | Sample size | Completeness Variance | Completeness Stdev |
|---|---|---|---|
| geo | 9 | 0.177758 | 0.4216 |
| bio | 7 | 0.141741 | 0.3765 |
| family | 8 | 0.139648 | 0.3737 |
| culture | 5 | 0.040000 | 0.2000 |
| social | 6 | 0.068637 | 0.2620 |
| econ | 7 | 0.129199 | 0.3594 |
| cognitive | 6 | 0.068637 | 0.2620 |
| modulator | 10 | 0.155903 | 0.3948 |

