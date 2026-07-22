// tests/confidence/helpers.js — shared fixture loader for tests/confidence/*.test.js.
// Same sharing pattern as scripts/golden-profiles.js's PROFILES/scoreAll being reused by
// scripts/compare-golden.js and scripts/ablate-layer-weights.js -- not a new convention.

const fs = require('fs');
const path = require('path');
const { computeEngine } = require('../../src/core-engine');
const confidence = require('../../src/confidence');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf8'));
}

// runFixture(name, config?) -> { fixture, engineResult, report }
function runFixture(name, config) {
  const fixture = loadFixture(name);
  const engineResult = computeEngine({
    precisionVectors: fixture.precisionVectors,
    subacuteTimestamps: fixture.subacuteTimestamps || {},
  });
  const report = config ? confidence.build(engineResult, config) : confidence.build(engineResult);
  return { fixture, engineResult, report };
}

// makeChecker() -> { check, report } -- same PASS/FAIL/count-and-exit-code convention as
// tests/test-cases.js's local check()/results()/process.exit() pattern, factored out only
// because this phase adds 5 test files instead of 1 (avoids 5 copies of identical boilerplate).
function makeChecker() {
  const results = [];
  function check(name, pass, detail) {
    results.push({ name, pass, detail });
  }
  function report() {
    let passCount = 0;
    results.forEach(r => {
      console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
      if (!r.pass && r.detail) console.log('        ' + r.detail);
      if (r.pass) passCount++;
    });
    console.log(`\n${passCount}/${results.length} checks passed.`);
    return passCount === results.length ? 0 : 1;
  }
  return { check, report };
}

module.exports = { loadFixture, runFixture, FIXTURES_DIR, makeChecker };
