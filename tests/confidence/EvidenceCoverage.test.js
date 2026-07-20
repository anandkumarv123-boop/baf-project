// tests/confidence/EvidenceCoverage.test.js
const { computeEngine, DIMS } = require('../../src/core-engine');
const EvidenceCoverage = require('../../src/confidence/EvidenceCoverage');
const { loadFixture, makeChecker } = require('./helpers');
const { check, report } = makeChecker();

function engineFor(name) {
  const fx = loadFixture(name);
  return computeEngine({ precisionVectors: fx.precisionVectors, subacuteTimestamps: fx.subacuteTimestamps || {} });
}

// TC1 -- perfect-dataset: all 48 subs answered -> every dimension's coverage is exactly 100
// (effectiveWeights sum to 1.0 over ALL_LAYER_IDS by construction; every layer fully answered
// means every touchFraction is 1, so the weighted sum is exactly 1.0 * 100).
{
  const r = engineFor('perfect-dataset');
  const cov = EvidenceCoverage.computeCoverage(r);
  DIMS.forEach(k => {
    check(`TC1 perfect-dataset: ${k} coverage == 100`, Math.abs(cov[k] - 100) < 0.01, `got ${cov[k]}`);
  });
}

// TC2 -- empty input: nothing answered anywhere -> every dimension's coverage is exactly 0.
{
  const r = computeEngine({});
  const cov = EvidenceCoverage.computeCoverage(r);
  DIMS.forEach(k => {
    check(`TC2 empty input: ${k} coverage == 0`, cov[k] === 0, `got ${cov[k]}`);
  });
}

// TC3 -- missing-data (3 of bio's 6 subs, bio weight 0.08): coverage must be well under 10,
// and strictly less than perfect-dataset's coverage for every dimension. This is the specific
// regression test for the bug this module's implementation deliberately avoids: naively
// renormalizing by only-answered-layers would make a single fully-answered small layer show
// ~100% coverage, which this assertion would catch.
{
  const r = engineFor('missing-data');
  const cov = EvidenceCoverage.computeCoverage(r);
  DIMS.forEach(k => {
    check(`TC3 missing-data: ${k} coverage < 10`, cov[k] < 10, `got ${cov[k]}`);
  });
}

// TC4 -- missing-data answers 3 of bio's 6 subs, all touching RT. touchFraction's denominator
// is bio's TOTAL sub count (6), not the answered count (3) -- so touchFraction = 3/6 = 0.5,
// and coverage = bio's declared weight (0.08) * 0.5 = 0.04 -> 4. This is the deliberate
// design point: only half of bio's evidence exists, even though what was given is internally
// consistent, so coverage should reflect "half of this layer", not "all of what I answered".
{
  const r = engineFor('missing-data');
  const cov = EvidenceCoverage.computeCoverage(r);
  check('TC4 missing-data: RT coverage == bio weight * (3/6) == 4', Math.abs(cov.RT - 4) < 0.01, `got ${cov.RT}`);
}

// TC5 -- high-evidence has strictly less coverage than perfect-dataset (5 subs missing,
// scattered) but strictly more than missing-data, on every dimension.
{
  const perfect = EvidenceCoverage.computeCoverage(engineFor('perfect-dataset'));
  const high = EvidenceCoverage.computeCoverage(engineFor('high-evidence'));
  const missing = EvidenceCoverage.computeCoverage(engineFor('missing-data'));
  DIMS.forEach(k => {
    check(`TC5 high-evidence ${k}: missing < high < perfect`, missing[k] < high[k] && high[k] < perfect[k],
      `missing=${missing[k]} high=${high[k]} perfect=${perfect[k]}`);
  });
}

// TC6 -- metadata reports which layers/subs actually contributed touching evidence for a
// dimension; for missing-data's RT, only bio's 3 answered subs should be listed.
{
  const r = engineFor('missing-data');
  const cov = EvidenceCoverage.computeCoverage(r);
  const bioEntry = cov.metadata.RT.layers.find(l => l.layer === 'bio');
  check('TC6 missing-data metadata: bio listed with 3 touching subs',
    !!bioEntry && bioEntry.touchingSubs.length === 3,
    JSON.stringify(cov.metadata.RT.layers));
  check('TC6b missing-data metadata: no other layer listed for RT',
    cov.metadata.RT.layers.length === 1, JSON.stringify(cov.metadata.RT.layers));
}

process.exit(report());
