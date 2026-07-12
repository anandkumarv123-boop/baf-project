// scripts/scenario-bank.js — fixed bank of 10 realistic decision scenarios for the
// continuous-improvement "learning case" external validation layer (see
// scripts/consistency-check.js). Adapted/trimmed from the Human Validation Protocol's
// Section 8/10 scenario set.
//
// Each option carries a `direction` vector: which way that choice *implies* the
// respondent leans on each of the engine's six dimensions (1 = implies positive/high,
// -1 = implies negative/low, 0 = that answer doesn't speak to that dimension). These
// are comparison vectors only, scored against an already-computed engine profile after
// the fact — they are NOT scoring inputs, do not feed into core-engine.js, and do not
// affect precisionVectors/microVectors or any finalVec computation anywhere.
//
// FUTURE ITEM (explicitly out of scope for this pass): Section 10-style external-rater
// data (spouse/friend/manager/parent/sibling ratings) is not implemented here. Collecting
// ratings *about* a respondent from other named people is a materially different privacy
// surface than the respondent's own opaque-coded answers, and needs its own consent flow
// (whose data is it, who can see it, how is the rater's own identity handled) designed
// before any code is written. Do not stub it — design it as its own piece of work first.

const { DIMS } = require('../src/core-engine');

function v(RT, SC, ER, AR, DS, SR) { return { RT, SC, ER, AR, DS, SR }; }

const SCENARIOS = [
  {
    id: 'market-crash',
    prompt: 'You invested a significant sum. The market crashes 45%.',
    options: [
      { id: 'sell-everything', label: 'Sell Everything', direction: v(-1, 0, 1, 0, 0, -1) },
      { id: 'sell-half', label: 'Sell Half', direction: v(-1, 0, 0, 0, 0, 0) },
      { id: 'hold', label: 'Hold', direction: v(0, 0, -1, 0, 0, 1) },
      { id: 'buy-more', label: 'Buy More', direction: v(1, 0, -1, 0, 1, 1) },
    ],
  },
  {
    id: 'public-criticism',
    prompt: 'Your manager blames you publicly for a mistake.',
    options: [
      { id: 'stay-silent', label: 'Stay Silent', direction: v(0, 1, -1, 1, -1, 0) },
      { id: 'defend-yourself', label: 'Defend Yourself', direction: v(0, -1, 0, -1, 1, 0) },
      { id: 'argue', label: 'Argue', direction: v(0, -1, 1, -1, 0, -1) },
      { id: 'speak-later', label: 'Speak Later (privately)', direction: v(0, 0, -1, 0, 1, 1) },
      { id: 'leave-company', label: 'Leave Company', direction: v(1, -1, 0, -1, 1, 0) },
    ],
  },
  {
    id: 'job-loss',
    prompt: 'You unexpectedly lose your job.',
    options: [
      { id: 'apply-immediately', label: 'Apply Immediately', direction: v(-1, 0, 0, 0, 0, 1) },
      { id: 'take-break', label: 'Take a Break', direction: v(0, 0, 0, 0, 0, -1) },
      { id: 'start-business', label: 'Start a Business', direction: v(1, 0, 0, 0, 1, 1) },
      { id: 'upskill', label: 'Upskill', direction: v(0, 0, 0, 0, 1, 1) },
      { id: 'borrow-money', label: 'Borrow Money', direction: v(0, 0, 0, 0, -1, -1) },
    ],
  },
  {
    id: 'windfall',
    prompt: 'You unexpectedly receive a large sum of money (e.g. ₹1 crore).',
    options: [
      { id: 'invest', label: 'Invest', direction: v(0, 0, 0, 0, 1, 1) },
      { id: 'buy-house', label: 'Buy a House', direction: v(-1, 1, 0, 0, 0, 1) },
      { id: 'luxury-spending', label: 'Luxury Spending', direction: v(1, -1, 1, 0, 0, -1) },
      { id: 'business', label: 'Start/Grow a Business', direction: v(1, 0, 0, 0, 1, 0) },
      { id: 'donate', label: 'Donate', direction: v(0, 1, 0, 0, 0, 0) },
    ],
  },
  {
    id: 'betrayal',
    prompt: 'Someone you trusted significantly (partner, close friend) breaks that trust.',
    options: [
      { id: 'confront-them', label: 'Confront Them Directly', direction: v(0, -1, 1, -1, 1, 0) },
      { id: 'cut-ties-silently', label: 'Cut Ties Silently', direction: v(0, -1, -1, 0, 1, 0) },
      { id: 'forgive-and-move-on', label: 'Forgive and Move On', direction: v(0, 1, -1, 0, 0, 1) },
      { id: 'escalate', label: 'Escalate (legal/HR/formal channel)', direction: v(0, 0, 1, 1, 0, 0) },
      { id: 'gather-evidence-first', label: 'Gather Evidence First', direction: v(0, 0, -1, 0, 1, 1) },
    ],
  },
  {
    id: 'business-failure',
    prompt: 'Your business loses its biggest client / core revenue source.',
    options: [
      { id: 'reduce-costs', label: 'Reduce Costs', direction: v(-1, 0, 0, 0, 1, 1) },
      { id: 'raise-funding', label: 'Raise Funding', direction: v(1, 0, 0, 0, 1, 0) },
      { id: 'pivot', label: 'Pivot', direction: v(1, 0, 0, 0, 1, 1) },
      { id: 'close-business', label: 'Close the Business', direction: v(-1, 0, 0, 0, 0, -1) },
      { id: 'ignore', label: 'Ignore', direction: v(0, 0, -1, 0, -1, -1) },
    ],
  },
  {
    id: 'embezzlement-discovery',
    prompt: 'You discover a trusted employee or partner has been embezzling funds.',
    options: [
      { id: 'confront-immediately', label: 'Confront Immediately', direction: v(0, 0, 1, -1, 1, 0) },
      { id: 'report-to-authorities', label: 'Report to Authorities', direction: v(0, 1, 0, 1, 0, 0) },
      { id: 'investigate-quietly-first', label: 'Investigate Quietly First', direction: v(0, 0, -1, 0, 1, 1) },
      { id: 'handle-internally', label: 'Handle Internally', direction: v(0, 1, 0, 0, 1, 0) },
      { id: 'avoid-confrontation', label: 'Avoid Confrontation', direction: v(0, 0, -1, 0, -1, -1) },
    ],
  },
  {
    id: 'guaranteed-vs-gamble',
    prompt: 'Choose: a guaranteed moderate payout, or a 50/50 shot at a much larger payout vs. nothing.',
    options: [
      { id: 'take-guaranteed', label: 'Take the Guaranteed Amount', direction: v(-1, 0, 0, 0, 0, 0) },
      { id: 'take-gamble', label: 'Take the Gamble', direction: v(1, 0, 0, 0, 0, 0) },
      { id: 'ask-for-more-time', label: 'Ask for More Time/Information', direction: v(0, 0, 0, 0, -1, 0) },
      { id: 'decline-both', label: 'Decline Both / Walk Away', direction: v(-1, 0, 0, 0, 1, 0) },
    ],
  },
  {
    id: 'time-pressured-decision',
    prompt: 'You must decide within 60 seconds whether to accept a job offer that expires today.',
    options: [
      { id: 'accept-immediately', label: 'Accept Immediately', direction: v(1, 0, 0, 0, 1, 1) },
      { id: 'decline-immediately', label: 'Decline Immediately', direction: v(-1, 0, 0, 0, 1, 0) },
      { id: 'ask-for-extension', label: 'Ask for an Extension', direction: v(0, 0, 0, 0, 1, 1) },
      { id: 'freeze-cant-decide', label: "Freeze / Can't Decide", direction: v(0, 0, 1, 0, -1, -1) },
      { id: 'consult-others-first', label: 'Consult Others First', direction: v(0, 1, 0, 0, -1, 0) },
    ],
  },
  {
    id: 'spouse-disagreement',
    prompt: 'Your spouse/partner disagrees with a significant financial decision you made.',
    options: [
      { id: 'discuss', label: 'Discuss', direction: v(0, 0, -1, 0, 0, 1) },
      { id: 'compromise', label: 'Compromise', direction: v(0, 1, -1, 0, 0, 1) },
      { id: 'ignore', label: 'Ignore', direction: v(0, 0, 0, 0, -1, -1) },
      { id: 'fight', label: 'Fight', direction: v(0, -1, 1, 0, 0, -1) },
      { id: 'delay', label: 'Delay', direction: v(0, 0, -1, 0, -1, 0) },
    ],
  },
];

const SCENARIO_IDS = SCENARIOS.map(s => s.id);

function getScenario(scenarioId) {
  return SCENARIOS.find(s => s.id === scenarioId) || null;
}

function getOption(scenarioId, optionId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) return null;
  return scenario.options.find(o => o.id === optionId) || null;
}

module.exports = { DIMS, SCENARIOS, SCENARIO_IDS, getScenario, getOption };
