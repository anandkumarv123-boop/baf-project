// tests/confidence/ConfidenceEstimator.test.js
const { DIMS } = require('../../src/core-engine');
const ConfidenceEstimator = require('../../src/confidence/ConfidenceEstimator');
const ConfidenceReport = require('../../src/confidence/ConfidenceReport');
const { EVIDENCE_STRENGTH_BUCKETS } = require('../../src/confidence/ConfidenceTypes');
const { runFixture, makeChecker } = require('./helpers');
const { check, report } = makeChecker();

// TC1 -- perfect-dataset end to end: confidence == 100*0.5 + 100*0.3 - 0*0.4 == 80 exactly,
// on every dimension, via the full estimate() pipeline (not a hand-computed composite).
{
  const { report: r } = runFixture('perfect-dataset');
  DIMS.forEach(k => {
    check(`TC1 perfect-dataset: ${k} confidence == 80`, Math.abs(r[k].confidence - 80) < 0.01, `got ${r[k].confidence}`);
    check(`TC1b perfect-dataset: ${k} evidenceStrength == Very Strong`, r[k].evidenceStrength === 'Very Strong', `got ${r[k].evidenceStrength}`);
  });
}

// TC2 -- empty input: coverage 0, no touching subs anywhere so consistency falls back to
// config.consistency.singleSampleDefault (100) on every dim, contradiction 0 ->
// confidence == 0*0.5 + 100*0.3 - 0*0.4 == 30.
{
  const { computeEngine } = require('../../src/core-engine');
  const empty = computeEngine({});
  const r = ConfidenceReport.build(empty);
  DIMS.forEach(k => {
    check(`TC2 empty input: ${k} confidence == 30 (0 coverage, default consistency)`, Math.abs(r[k].confidence - 30) < 0.01, `got ${r[k].confidence}`);
    check(`TC2b empty input: ${k} score == 0`, r[k].score === 0, `got ${r[k].score}`);
  });
}

// TC3 -- ordering invariant across the 6 fixtures: low-evidence (sparse+contradiction) must
// score the worst, perfect-dataset must score at least as well as high-evidence (which is
// missing 5 subs), and high-contradiction must score worse than high-evidence despite
// comparable coverage, because of its maximal contradictionPenalty.
{
  const scoresOf = name => runFixture(name).report.RT.confidence;
  const low = scoresOf('low-evidence');
  const missing = scoresOf('missing-data');
  const highContra = scoresOf('high-contradiction');
  const highEv = scoresOf('high-evidence');
  const perfect = scoresOf('perfect-dataset');

  check('TC3a low-evidence is the worst of the five', low <= missing && low <= highContra && low <= highEv && low <= perfect,
    `low=${low} missing=${missing} highContra=${highContra} highEv=${highEv} perfect=${perfect}`);
  check('TC3b perfect-dataset >= high-evidence', perfect >= highEv, `perfect=${perfect} highEv=${highEv}`);
  check('TC3c high-contradiction < high-evidence despite similar coverage', highContra < highEv, `highContra=${highContra} highEv=${highEv}`);
}

// TC4 -- every dimension's confidence is clamped into [0, 100] and evidenceStrength is
// always one of the 5 documented buckets, across all 6 fixtures including the fuzz fixture.
{
  ['perfect-dataset', 'missing-data', 'high-contradiction', 'low-evidence', 'high-evidence', 'random-inputs'].forEach(name => {
    const { report: r } = runFixture(name);
    DIMS.forEach(k => {
      const c = r[k].confidence;
      check(`TC4 ${name} ${k}: confidence in [0,100]`, typeof c === 'number' && !Number.isNaN(c) && c >= 0 && c <= 100, `got ${c}`);
      check(`TC4b ${name} ${k}: evidenceStrength is a valid bucket`, EVIDENCE_STRENGTH_BUCKETS.includes(r[k].evidenceStrength), `got ${r[k].evidenceStrength}`);
      check(`TC4c ${name} ${k}: evidenceCoverage in [0,100]`, r[k].evidenceCoverage >= 0 && r[k].evidenceCoverage <= 100, `got ${r[k].evidenceCoverage}`);
      check(`TC4d ${name} ${k}: contradictionPenalty in [0,100]`, r[k].contradictionPenalty >= 0 && r[k].contradictionPenalty <= 100, `got ${r[k].contradictionPenalty}`);
    });
  });
}

// TC5 -- `reliability` is never present anywhere in the report -- deferred to Phase 3,
// deliberately not stubbed even as null/undefined.
{
  ['perfect-dataset', 'missing-data', 'random-inputs'].forEach(name => {
    const { report: r } = runFixture(name);
    DIMS.forEach(k => {
      check(`TC5 ${name} ${k}: no reliability key present`, !('reliability' in r[k]), `keys: ${Object.keys(r[k]).join(',')}`);
    });
  });
}

// TC6 -- `score` in the final report is bit-identical to the raw engine finalVec, not
// recomputed or rounded, for every fixture.
{
  const { computeEngine } = require('../../src/core-engine');
  ['perfect-dataset', 'high-contradiction'].forEach(name => {
    const { fixture, engineResult, report: r } = runFixture(name);
    DIMS.forEach(k => {
      check(`TC6 ${name} ${k}: score bit-identical to finalVec`, r[k].score === engineResult.finalVec[k], `got ${r[k].score} vs ${engineResult.finalVec[k]}`);
    });
  });
}

process.exit(report());
