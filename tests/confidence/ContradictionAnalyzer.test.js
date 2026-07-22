// tests/confidence/ContradictionAnalyzer.test.js
const { computeEngine, DIMS } = require('../../src/core-engine');
const ContradictionAnalyzer = require('../../src/confidence/ContradictionAnalyzer');
const { loadFixture, makeChecker } = require('./helpers');
const { check, report } = makeChecker();

function engineFor(name) {
  const fx = loadFixture(name);
  return computeEngine({ precisionVectors: fx.precisionVectors, subacuteTimestamps: fx.subacuteTimestamps || {} });
}

// TC1 -- perfect-dataset: both dampener pairs answered with IDENTICAL vectors -> zero
// divergence, zero contradictionPenalty on every dimension, no conflicts flagged.
{
  const r = engineFor('perfect-dataset');
  const a = ContradictionAnalyzer.analyze(r);
  DIMS.forEach(k => check(`TC1 perfect-dataset: ${k} perDimension == 0`, a.perDimension[k] === 0, `got ${a.perDimension[k]}`));
  check('TC1b perfect-dataset: no conflicts flagged', a.conflicts.length === 0, JSON.stringify(a.conflicts));
}

// TC2 -- empty input: neither pair answered (nothing answered at all) -> zero penalty,
// no conflicts (the "needs both answered" guard must hold, same as the engine's own
// dampeners at core-engine.js:136-137, 194).
{
  const r = computeEngine({});
  const a = ContradictionAnalyzer.analyze(r);
  DIMS.forEach(k => check(`TC2 empty input: ${k} perDimension == 0`, a.perDimension[k] === 0, `got ${a.perDimension[k]}`));
  check('TC2b empty input: no conflicts', a.conflicts.length === 0, JSON.stringify(a.conflicts));
}

// TC3 -- low-evidence: ONLY attachment_style (+2 all dims) and parenting (-2 all dims)
// answered -- maximum possible divergence on the -2..2 scale. |2-(-2)|/4*100 == 100 exactly,
// on every dimension, and the pair must be flagged as a conflict.
{
  const r = engineFor('low-evidence');
  const a = ContradictionAnalyzer.analyze(r);
  DIMS.forEach(k => check(`TC3 low-evidence: ${k} perDimension == 100 (max divergence)`, a.perDimension[k] === 100, `got ${a.perDimension[k]}`));
  check('TC3b low-evidence: exactly one conflict flagged', a.conflicts.length === 1, JSON.stringify(a.conflicts));
  check('TC3c low-evidence: conflict is attachment_style/parenting', a.conflicts.length === 1 && a.conflicts[0].pairIds.join(',') === 'attachment_style,parenting', JSON.stringify(a.conflicts));
  check('TC3d low-evidence: conflict kind is same-layer', a.conflicts.length === 1 && a.conflicts[0].kind === 'same-layer', JSON.stringify(a.conflicts));
  check('TC3e low-evidence: affected layer is family', a.affectedLayers.length === 1 && a.affectedLayers[0] === 'family', JSON.stringify(a.affectedLayers));
}

// TC4 -- high-contradiction: BOTH pairs answered maximally opposite -> both flagged, and
// both family and modulator show up as affected layers (attachment_style/parenting are both
// family; emotional_trauma is modulator, stability is family, so family appears via both
// pairs but modulator only via the cross-layer one).
{
  const r = engineFor('high-contradiction');
  const a = ContradictionAnalyzer.analyze(r);
  check('TC4 high-contradiction: 2 conflicts flagged', a.conflicts.length === 2, JSON.stringify(a.conflicts));
  check('TC4b high-contradiction: family and modulator both affected', a.affectedLayers.includes('family') && a.affectedLayers.includes('modulator'), JSON.stringify(a.affectedLayers));
  DIMS.forEach(k => check(`TC4c high-contradiction: ${k} perDimension == 100`, a.perDimension[k] === 100, `got ${a.perDimension[k]}`));
}

// TC5 -- a pair with only ONE member answered contributes nothing, same guarantee the
// engine's own dampeners provide (core-engine.js:136-137).
{
  const r = computeEngine({ precisionVectors: { attachment_style: { RT: 2, SC: 2, ER: 2, AR: 2, DS: 2, SR: 2 } } });
  const a = ContradictionAnalyzer.analyze(r);
  DIMS.forEach(k => check(`TC5 single-member pair: ${k} perDimension == 0`, a.perDimension[k] === 0, `got ${a.perDimension[k]}`));
  check('TC5b single-member pair: no conflicts', a.conflicts.length === 0, JSON.stringify(a.conflicts));
}

process.exit(report());
