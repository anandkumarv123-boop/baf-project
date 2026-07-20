// tests/confidence/mutability.test.js — REQUIRED guard per the Phase 2 spec.
//
// Phase 1 (docs/validation/weight-validation.md) found empirically that src/core-engine.js's
// SUBACUTE_WEIGHT, SAME_LAYER_PAIR_WEIGHT, and CROSS_LAYER_DISCOUNT are `const` primitives
// closed over internally by computeEngine() -- mutating their exported copies is a verified
// no-op on scoring, because a primitive export is a value copy, not a live reference. This
// test proves config/confidenceConfig.js does NOT have that problem: it's a plain object, and
// every src/confidence/* module reads its properties fresh inside function bodies, so
// mutating it genuinely changes output on the next call. Same empirical technique as Phase 1,
// opposite finding -- there, it disproved mutability; here, it proves it holds.

const defaultConfig = require('../../config/confidenceConfig');
const ConfidenceEstimator = require('../../src/confidence/ConfidenceEstimator');
const EvidenceStrength = require('../../src/confidence/EvidenceStrength');
const { runFixture, makeChecker } = require('./helpers');
const { check, report } = makeChecker();

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// TC1 -- baseline: confirm the default config produces the expected, unmutated composite on
// a known fixture before mutating anything (same fixture/expectation as
// ConfidenceEstimator.test.js's TC1, restated here so this file stands alone).
{
  const { report: baseline } = runFixture('perfect-dataset');
  check('TC1 baseline (unmutated config): RT confidence == 80', Math.abs(baseline.RT.confidence - 80) < 0.01, `got ${baseline.RT.confidence}`);
}

// TC2 -- clone the config, mutate the CLONE's weights, and confirm the ORIGINAL
// (require-cached) config object is untouched -- proves the clone step itself is real, not
// a no-op alias of the same object.
{
  const clone = deepClone(defaultConfig);
  clone.weights.coverage = 0.9;
  check('TC2 mutating a clone does not affect the original config object', defaultConfig.weights.coverage === 0.5, `original coverage weight is now ${defaultConfig.weights.coverage}`);
}

// TC3 -- THE required guard: mutate a clone's weights, pass it explicitly to estimate(), and
// assert the output genuinely differs from the default-config run on the identical fixture.
// If confidence engine modules had made the Phase 1 mistake (destructuring config values into
// local consts at require-time instead of reading them per-call), this mutated-config run
// would silently produce the SAME output as the default run -- exactly the failure mode this
// guard exists to catch.
{
  const { engineResult } = runFixture('high-evidence');
  const defaultResult = ConfidenceEstimator.estimate(engineResult, defaultConfig);

  const mutated = deepClone(defaultConfig);
  mutated.weights.coverage = 0.05;
  mutated.weights.consistency = 0.05;
  mutated.weights.contradiction = 0.9;
  const mutatedResult = ConfidenceEstimator.estimate(engineResult, mutated);

  check('TC3 mutated-config output differs from default-config output on the same fixture',
    defaultResult.RT.confidence !== mutatedResult.RT.confidence,
    `default=${defaultResult.RT.confidence} mutated=${mutatedResult.RT.confidence} (identical means config mutation had no effect)`);
}

// TC4 -- same guard, applied to EvidenceStrength's thresholds specifically (a different
// config sub-tree than TC3's weights, to catch a module that reads `config.weights` fresh but
// still destructured `config.evidenceStrength.thresholds` at require-time).
{
  const signals = { coverage: 50, consistency: 50, contradictions: 10 };
  const defaultBucket = EvidenceStrength.strengthOf(signals, defaultConfig);

  const mutated = deepClone(defaultConfig);
  mutated.evidenceStrength.thresholds = { veryWeak: 90, weak: 91, moderate: 92, strong: 93 };
  const mutatedBucket = EvidenceStrength.strengthOf(signals, mutated);

  check('TC4 mutated evidenceStrength thresholds change the bucket for identical signals',
    defaultBucket !== mutatedBucket,
    `default=${defaultBucket} mutated=${mutatedBucket} (identical means threshold mutation had no effect)`);
}

// TC5 -- mutating config.consistency.singleSampleDefault changes the empty-input confidence
// (which depends entirely on that fallback, per ConfidenceEstimator.test.js's TC2).
{
  const { computeEngine } = require('../../src/core-engine');
  const empty = computeEngine({});

  const defaultResult = ConfidenceEstimator.estimate(empty, defaultConfig);
  const mutated = deepClone(defaultConfig);
  mutated.consistency.singleSampleDefault = 0;
  const mutatedResult = ConfidenceEstimator.estimate(empty, mutated);

  check('TC5 mutated consistency.singleSampleDefault changes empty-input confidence',
    defaultResult.RT.confidence !== mutatedResult.RT.confidence,
    `default=${defaultResult.RT.confidence} mutated=${mutatedResult.RT.confidence}`);
}

process.exit(report());
