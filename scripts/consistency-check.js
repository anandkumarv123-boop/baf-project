// scripts/consistency-check.js — external validation layer: compares an already-computed
// engine profile (its finalVec) against scenario-based decisions from
// scripts/scenario-bank.js, per dimension. This is a comparison/reporting layer only --
// it reads a finished finalVec and reports agreement/contradiction against it. It does
// not call computeEngine, does not modify any score, and does not add any new scoring
// input to core-engine.js.

const { DIMS } = require('../src/core-engine');
const { SCENARIOS, getScenario, getOption } = require('./scenario-bank');

// Engine values within +/-0.05 of zero are treated as neutral rather than weakly
// positive/negative -- same magnitude as compare-golden.js's own drift threshold, for the
// same reason: comfortably above floating-point noise, comfortably below a real signal
// on the engine's -2..2 scale.
const NEUTRAL_EPSILON = 0.05;

function sign(x) {
  if (x > NEUTRAL_EPSILON) return 1;
  if (x < -NEUTRAL_EPSILON) return -1;
  return 0;
}

function netDirectionLabel(touches) {
  const net = touches.reduce((a, t) => a + t.expected, 0);
  if (net > 0) return 'positive';
  if (net < 0) return 'negative';
  return 'mixed';
}

// engineFinalVec: {RT,SC,ER,AR,DS,SR} -- a profile's already-computed finalVec.
// scenarioAnswers: { [scenarioId]: optionId }
function checkConsistency(engineFinalVec, scenarioAnswers) {
  const unknownScenarioIds = Object.keys(scenarioAnswers).filter(id => !getScenario(id));
  if (unknownScenarioIds.length) {
    throw new Error(`Unknown scenario id(s): ${unknownScenarioIds.join(', ')}`);
  }

  const resolvedAnswers = Object.entries(scenarioAnswers).map(([scenarioId, optionId]) => {
    const option = getOption(scenarioId, optionId);
    if (!option) throw new Error(`Unknown option id '${optionId}' for scenario '${scenarioId}'`);
    return { scenarioId, optionId, direction: option.direction };
  });

  const perDimension = DIMS.map(k => {
    const touches = resolvedAnswers
      .filter(a => a.direction[k] !== 0)
      .map(a => ({ scenarioId: a.scenarioId, optionId: a.optionId, expected: a.direction[k] }));

    const engineValue = engineFinalVec[k];
    const engineSign = sign(engineValue);
    const engineDirection = engineSign > 0 ? 'positive' : engineSign < 0 ? 'negative' : 'neutral';

    if (touches.length === 0) {
      return {
        dimension: k, engineValue, engineDirection,
        scenarioImpliedDirection: 'no-data',
        touches: 0, agreements: 0, contradictions: 0,
        status: 'no-data', confidence: 0,
      };
    }

    if (engineDirection === 'neutral') {
      return {
        dimension: k, engineValue, engineDirection,
        scenarioImpliedDirection: netDirectionLabel(touches),
        touches: touches.length, agreements: 0, contradictions: 0,
        status: 'inconclusive', confidence: 0,
      };
    }

    const agreements = touches.filter(t => t.expected === engineSign).length;
    const contradictions = touches.length - agreements;
    const status = agreements === touches.length ? 'agree'
      : contradictions === touches.length ? 'contradict'
      : 'partial';
    // Rewards both coverage (how many scenarios touched this dimension) and consistency
    // (how many of those touches point the same way) in one number: the count of touches
    // in the majority direction, out of the full 10-scenario bank.
    const confidence = Math.round((Math.max(agreements, contradictions) / SCENARIOS.length) * 100) / 100;

    return {
      dimension: k, engineValue, engineDirection,
      scenarioImpliedDirection: netDirectionLabel(touches),
      touches: touches.length, agreements, contradictions, status, confidence,
    };
  });

  const overall = {
    agree: perDimension.filter(d => d.status === 'agree').length,
    contradict: perDimension.filter(d => d.status === 'contradict').length,
    partial: perDimension.filter(d => d.status === 'partial').length,
    inconclusive: perDimension.filter(d => d.status === 'inconclusive').length,
    noData: perDimension.filter(d => d.status === 'no-data').length,
  };

  return { perDimension, overall };
}

module.exports = { checkConsistency, NEUTRAL_EPSILON };
