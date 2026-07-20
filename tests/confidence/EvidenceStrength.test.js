// tests/confidence/EvidenceStrength.test.js
const EvidenceStrength = require('../../src/confidence/EvidenceStrength');
const { EVIDENCE_STRENGTH_BUCKETS } = require('../../src/confidence/ConfidenceTypes');
const { makeChecker } = require('./helpers');
const { check, report } = makeChecker();

// Default config weights: coverage 0.5, consistency 0.3, contradiction 0.4.
// Default thresholds: veryWeak<20, weak<40, moderate<60, strong<80, else veryStrong.

// TC1 -- pure function, no engine access: same input twice -> identical output (no hidden
// state, no dependency on anything but the arguments and the (defaulted) config).
{
  const signals = { coverage: 70, consistency: 60, contradictions: 10 };
  const a = EvidenceStrength.strengthOf(signals);
  const b = EvidenceStrength.strengthOf(signals);
  check('TC1 strengthOf is pure (same input -> same output)', a === b, `${a} vs ${b}`);
}

// TC2 -- composite = 0*0.5 + 0*0.3 - 0*0.4 = 0 -> Very Weak (below all thresholds).
{
  const s = EvidenceStrength.strengthOf({ coverage: 0, consistency: 0, contradictions: 0 });
  check('TC2 all-zero signals -> Very Weak', s === 'Very Weak', `got ${s}`);
}

// TC3 -- composite = 100*0.5 + 100*0.3 - 0*0.4 = 80 -> Very Strong (>= strong threshold of 80).
{
  const s = EvidenceStrength.strengthOf({ coverage: 100, consistency: 100, contradictions: 0 });
  check('TC3 full coverage+consistency, no contradiction -> Very Strong', s === 'Very Strong', `got ${s}`);
}

// TC4 -- same coverage/consistency as TC3, but maximal contradiction (100) drags the
// composite down to 80 - 40 = 40 -> exactly at the weak/moderate boundary (< 60), Moderate.
{
  const s = EvidenceStrength.strengthOf({ coverage: 100, consistency: 100, contradictions: 100 });
  check('TC4 full coverage+consistency but max contradiction -> Moderate', s === 'Moderate', `got ${s}`);
}

// TC5 -- output is always one of the 5 documented buckets, for a spread of inputs
// (bounds/fuzz check, not exact-value).
{
  const samples = [
    { coverage: 0, consistency: 0, contradictions: 100 },
    { coverage: 100, consistency: 0, contradictions: 0 },
    { coverage: 50, consistency: 50, contradictions: 50 },
    { coverage: 33.3, consistency: 91.2, contradictions: 4.4 },
  ];
  samples.forEach((s, i) => {
    const result = EvidenceStrength.strengthOf(s);
    check(`TC5.${i} strengthOf always returns a valid bucket`, EVIDENCE_STRENGTH_BUCKETS.includes(result), `got ${result} for ${JSON.stringify(s)}`);
  });
}

// TC6 -- config is genuinely consulted, not just a default parameter that's ignored:
// tightening every threshold to 0 forces every input (other than exactly composite<0,
// impossible given the clamp) into "Very Strong".
{
  const tightConfig = { weights: { coverage: 0.5, consistency: 0.3, contradiction: 0.4 }, evidenceStrength: { thresholds: { veryWeak: 0, weak: 0, moderate: 0, strong: 0 } } };
  const s = EvidenceStrength.strengthOf({ coverage: 0, consistency: 0, contradictions: 0 }, tightConfig);
  check('TC6 zero-thresholds config -> even all-zero signals bucket as Very Strong', s === 'Very Strong', `got ${s}`);
}

process.exit(report());
