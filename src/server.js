// server.js — implements BAF_Technical_Architecture.docx Section 3.5 API Surface:
//   POST /v1/profile            -> create profile from layer inputs, returns scores + narrative
//   GET  /v1/profile/:id        -> fetch stored profile
//   GET  /v1/weights/:version   -> fetch active weighting config
//   POST /v1/weights            -> (admin) publish new weight version
//
// Scoring logic is imported unmodified from core-engine.js (same file backing the
// regression suite and BAF_Simulator_v6.html) — no scoring math is duplicated here.

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { computeEngine, LAYER_WEIGHTS, ALL_SUB_IDS, DIMS } = require('./core-engine');
const store = require('./store');
const { SCENARIOS, getScenario, getOption } = require('../scripts/scenario-bank');
const { checkConsistency } = require('../scripts/consistency-check');
const { build: buildConfidenceReport } = require('./confidence');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 4000;

// Seed weight_version 1 on first boot if none exists
async function seedWeights() {
  if (!(await store.getWeightVersion('latest'))) {
    await store.saveWeightVersion({
      version: 1,
      published_at: new Date().toISOString(),
      weights: LAYER_WEIGHTS,
      note: 'v6 baseline — confidence-corrected nutrition/temperament sub-layers included',
    });
  }
}

function describe(dimKey, positive) {
  const map = {
    RT: positive ? 'seeks novelty, accepts uncertainty' : 'leans cautious, prefers predictability',
    SC: positive ? 'calibrates to group norms' : 'acts independent of group expectation',
    ER: positive ? 'heightened emotional reactivity to shifts' : 'even emotional baseline under pressure',
    AR: positive ? 'defers to authority/structure' : 'questions or resists authority',
    DS: positive ? 'independent, analytical decisions' : 'consensus-seeking, intuitive decisions',
    SR: positive ? 'strong resilience under stress' : 'reduced buffering under stress',
  };
  return map[dimKey];
}

function buildNarrative(finalVec, answeredSubsTotal, totalSubs) {
  const labels = { RT: 'Risk Tolerance', SC: 'Social Conformity', ER: 'Emotional Reactivity', AR: 'Authority Deference', DS: 'Independent Decision-Making', SR: 'Stress Resilience' };
  const sorted = DIMS.map(k => ({ k, label: labels[k], val: finalVec[k] })).sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
  const top = sorted.slice(0, 3);
  let out = `Dominant signal: ${top[0].label} — ${describe(top[0].k, top[0].val >= 0)}. `;
  out += `Reinforced by ${top[1].label} (${describe(top[1].k, top[1].val >= 0)}) and ${top[2].label} (${describe(top[2].k, top[2].val >= 0)}). `;
  out += `Built from ${answeredSubsTotal}/${totalSubs} sub-layers; missing data excluded, not zero-filled.`;
  return out;
}

// POST /v1/profile
// body: { precisionVectors?: {subId:{RT,SC,ER,AR,DS,SR}}, microVectors?: {subId:[vec,...]},
//         subacuteTimestamps?: {subId:isoString} }  -- subacuteTimestamps applies only to
//         Tier S sub-layers (grief, life_transitions); see core-engine.js's computeEngine.
app.post('/v1/profile', async (req, res) => {
  const { precisionVectors = {}, microVectors = {}, subacuteTimestamps = {} } = req.body || {};
  const invalidIds = Object.keys({ ...precisionVectors, ...microVectors }).filter(id => !ALL_SUB_IDS.includes(id));
  if (invalidIds.length) {
    return res.status(400).json({ error: 'Unknown sub-layer id(s)', invalidIds, validIds: ALL_SUB_IDS });
  }

  const result = computeEngine({ precisionVectors, microVectors, subacuteTimestamps });
  const profile = {
    id: uuidv4(),
    created_at: new Date().toISOString(),
    input: { precisionVectors, microVectors, subacuteTimestamps },
    finalScore: result.finalVec,
    perLayer: result.layerVecs,
    answeredSubsTotal: result.answeredSubsTotal,
    totalSubs: result.totalSubs,
    completeness: result.completeness,
    confidence: result.completeness >= 0.85 ? 'High' : result.completeness >= 0.6 ? 'Moderate' : 'Partial — low confidence',
    // Additive only (Phase 2 / Confidence Engine, src/confidence/) -- a per-dimension
    // confidence envelope alongside the pre-existing completeness-threshold `confidence`
    // string above. `finalScore`/`confidence`/`perLayer` etc. are all untouched; no existing
    // consumer of this response needs to change. See docs/confidence-engine.md.
    confidenceReport: buildConfidenceReport(result),
    subacuteStale: result.subacuteStale,
    staleSubacuteSubs: result.staleSubacuteSubs,
    narrative: buildNarrative(result.finalVec, result.answeredSubsTotal, result.totalSubs),
    disclaimer: 'Heuristic self-reflection model only — not a psychological assessment, diagnosis, or predictive instrument.',
  };
  await store.saveProfile(profile);
  res.status(201).json(profile);
});

// GET /v1/profile/:id
app.get('/v1/profile/:id', async (req, res) => {
  const profile = await store.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

// GET /v1/profile  (list — not in original spec, added for practical testing/admin use)
app.get('/v1/profile', async (req, res) => {
  res.json(await store.listProfiles());
});

// GET /v1/weights/:version  ('latest' or a numeric version)
app.get('/v1/weights/:version', async (req, res) => {
  const v = req.params.version;
  const entry = await store.getWeightVersion(v === 'latest' ? 'latest' : Number(v));
  if (!entry) return res.status(404).json({ error: 'Weight version not found' });
  res.json(entry);
});

// POST /v1/weights  (admin — publish new weight version)
// body: { weights: {geo:..,bio:..,...}, note?: string }
app.post('/v1/weights', async (req, res) => {
  const { weights, note } = req.body || {};
  if (!weights) return res.status(400).json({ error: 'weights object required' });
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    return res.status(400).json({ error: `Layer weights must sum to 1.00 (got ${sum.toFixed(4)})` });
  }
  const latest = await store.getWeightVersion('latest');
  const entry = {
    version: (latest ? latest.version : 0) + 1,
    published_at: new Date().toISOString(),
    weights,
    note: note || null,
  };
  await store.saveWeightVersion(entry);
  res.status(201).json(entry);
});

// ---- Learning cases (continuous-improvement external validation layer) ----
// Compares an existing profile's engine output against scenario-based decisions
// (scripts/scenario-bank.js / scripts/consistency-check.js). Additive only: does not
// read or write anything under profiles.scores, and does not affect computeEngine.
//
// respondent_code is required to be an opaque code (letters/digits/hyphen/underscore,
// max 32 chars) -- structurally rejects names, addresses, or other free-text identifiers
// per the privacy constraints this feature was built under.
const RESPONDENT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const LEARNING_CASE_STATUSES = ['new', 'reviewed', 'actioned'];
const DEFAULT_ENGINE_VERSION = 'v6.3';

// POST /v1/learning-case
// body: { respondent_code, profile_id, scenario_answers: {scenarioId: optionId},
//         reviewer_notes?, version? }
app.post('/v1/learning-case', async (req, res) => {
  const { respondent_code, profile_id, scenario_answers = {}, reviewer_notes = null, version } = req.body || {};

  if (!respondent_code || typeof respondent_code !== 'string' || !RESPONDENT_CODE_PATTERN.test(respondent_code)) {
    return res.status(400).json({ error: 'respondent_code must be an opaque code (e.g. "R-0042"): letters, digits, "-", "_" only, no free text' });
  }
  if (!profile_id || typeof profile_id !== 'string') {
    return res.status(400).json({ error: 'profile_id is required' });
  }
  const profile = await store.getProfile(profile_id);
  if (!profile) {
    return res.status(400).json({ error: `profile_id '${profile_id}' does not exist` });
  }

  const unknownScenarioIds = Object.keys(scenario_answers).filter(id => !getScenario(id));
  if (unknownScenarioIds.length) {
    return res.status(400).json({ error: 'Unknown scenario id(s)', unknownScenarioIds, validScenarioIds: SCENARIOS.map(s => s.id) });
  }
  for (const [scenarioId, optionId] of Object.entries(scenario_answers)) {
    if (!getOption(scenarioId, optionId)) {
      return res.status(400).json({
        error: `Unknown option id '${optionId}' for scenario '${scenarioId}'`,
        validOptionIds: getScenario(scenarioId).options.map(o => o.id),
      });
    }
  }

  let consistencyReport;
  try {
    consistencyReport = checkConsistency(profile.finalScore, scenario_answers);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const learningCase = {
    id: uuidv4(),
    respondent_code,
    date: new Date().toISOString(),
    profile_id,
    scenario_answers,
    consistency_report: consistencyReport,
    reviewer_notes,
    status: 'new',
    version: version || DEFAULT_ENGINE_VERSION,
  };
  await store.saveLearningCase(learningCase);
  res.status(201).json(learningCase);
});

// GET /v1/learning-case/:id
app.get('/v1/learning-case/:id', async (req, res) => {
  const learningCase = await store.getLearningCase(req.params.id);
  if (!learningCase) return res.status(404).json({ error: 'Learning case not found' });
  res.json(learningCase);
});

// GET /v1/learning-case  (list, optional ?status=new|reviewed|actioned)
app.get('/v1/learning-case', async (req, res) => {
  const { status } = req.query;
  if (status && !LEARNING_CASE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter', validStatuses: LEARNING_CASE_STATUSES });
  }
  res.json(await store.listLearningCases({ status }));
});

app.get('/v1/health', (req, res) => res.json({ status: 'ok', engine: 'BAF v6', subLayers: ALL_SUB_IDS.length }));

seedWeights()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`BAF Engine API listening on port ${PORT}`);
      console.log(`Sub-layers loaded: ${ALL_SUB_IDS.length}`);
    });
  })
  .catch(err => {
    console.error('Failed to seed weight config:', err);
    process.exit(1);
  });

module.exports = app;
