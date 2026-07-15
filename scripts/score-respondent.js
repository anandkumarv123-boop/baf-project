// scripts/score-respondent.js — scores one respondent's submitted JSON (the exact format
// docs/index.html downloads/submits: respondent_code, date, baseline_1to5, answers with
// {sub}_pick letters and {sub}_slider 1-5 values) through the real engine. Produces the
// same result as entering the same answers by hand in BAF_Simulator_v6.html's Precision
// Mode, because it reuses that tool's own math rather than reimplementing it:
//
//   - Sub-layer option/slider vectors are read live from BAF_Simulator_v6.html's LAYERS
//     array (same single source of truth used by tests/test-cases.js's TC14 and
//     scripts/generate-questionnaire.js) -- this can never silently drift from the
//     production tool's own data.
//   - The slider-scaling formula and the pick+slider averaging are done via
//     core-engine.js's own exported scaleVec/subScoreFrom, not reimplemented here --
//     identical to BAF_Simulator_v6.html's own scaleVec/microVec/subScore functions.
//   - The per-sub vectors are then fed into core-engine.js's real computeEngine() as
//     precisionVectors, exactly as POST /v1/profile does.
//
// This is the permanent tool for scoring every future respondent submission, not a
// one-off script.
//
// Usage: node scripts/score-respondent.js path/to/respondent.json

const fs = require('fs');
const path = require('path');
const os = require('os');
const { DIMS, scaleVec, subScoreFrom, computeEngine, ALL_SUB_IDS } = require('../src/core-engine');

const ROOT = path.join(__dirname, '..');

// Same extraction technique as scripts/generate-questionnaire.js and tests/test-cases.js's
// TC14 live cross-check: read LAYERS straight out of the production HTML, not a copy.
function loadLayers() {
  const html = fs.readFileSync(path.join(ROOT, 'BAF_Simulator_v6.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const snippet = script.slice(script.indexOf('const DIMS'), script.indexOf('const TOTAL_SUBS'));
  const tmp = path.join(os.tmpdir(), '_score_respondent_layers.js');
  fs.writeFileSync(tmp, snippet + '\nmodule.exports = { LAYERS };');
  delete require.cache[require.resolve(tmp)];
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod.LAYERS;
}

function buildSubIndex(layers) {
  const index = {};
  layers.forEach(layer => {
    layer.subs.forEach(sub => { index[sub.id] = sub; });
  });
  return index;
}

// Resolves one sub-layer's precision vector from a respondent's pick letter + slider
// value. Mirrors BAF_Simulator_v6.html's microVec()/subScore() exactly: the pick's option
// vector is used as-is, the slider's full-effect vector is scaled by (value-3)/2 (value 3
// = neutral = contributes nothing, 1 or 5 = the full -1x/+1x effect), and the two answered
// micro-vectors are averaged via core-engine.js's own subScoreFrom -- the same function
// the live engine uses for micro-vector averaging, not a reimplementation of it.
function resolveSubVector(sub, pickLetter, sliderValue) {
  const pickMicro = sub.micro.find(m => m.type === 'select');
  const sliderMicro = sub.micro.find(m => m.type === 'slider');
  const microVecs = [];

  if (pickLetter !== undefined && pickLetter !== null && pickLetter !== '') {
    const idx = String(pickLetter).toUpperCase().charCodeAt(0) - 65; // 'A' -> 0, 'B' -> 1, ...
    const option = pickMicro && pickMicro.options[idx];
    if (!option) {
      throw new Error(`Sub-layer '${sub.id}': no option '${pickLetter}' (pick has ${pickMicro ? pickMicro.options.length : 0} options)`);
    }
    microVecs.push(option.v);
  }
  if (sliderValue !== undefined && sliderValue !== null && sliderValue !== '') {
    if (!sliderMicro) throw new Error(`Sub-layer '${sub.id}': has no slider micro-item`);
    microVecs.push(scaleVec(sliderMicro.v, (Number(sliderValue) - 3) / 2));
  }

  if (microVecs.length === 0) return null;
  return subScoreFrom({}, { [sub.id]: microVecs }, sub.id);
}

function scoreRespondent(respondent, layers) {
  const subIndex = buildSubIndex(layers);
  const precisionVectors = {};
  const skipped = [];

  ALL_SUB_IDS.forEach(subId => {
    const sub = subIndex[subId];
    if (!sub) {
      throw new Error(`Sub-layer '${subId}' (from core-engine.js) not found in BAF_Simulator_v6.html LAYERS -- the two have drifted apart`);
    }
    const answers = respondent.answers || {};
    const vec = resolveSubVector(sub, answers[subId + '_pick'], answers[subId + '_slider']);
    if (vec === null) { skipped.push(subId); return; }
    precisionVectors[subId] = vec;
  });

  const result = computeEngine({ precisionVectors });
  return { result, skipped, precisionVectors };
}

function printReport(respondent, result, skipped) {
  console.log(`Respondent: ${respondent.respondent_code || '(none)'}  Date: ${respondent.date || '(none)'}`);
  console.log(`Answered sub-layers: ${result.answeredSubsTotal}/${result.totalSubs}  Completeness: ${(result.completeness * 100).toFixed(1)}%`);
  if (skipped.length) console.log(`Unanswered sub-layers (${skipped.length}): ${skipped.join(', ')}`);
  console.log('');
  console.log('Final score (finalVec):');
  DIMS.forEach(k => console.log(`  ${k}: ${result.finalVec[k].toFixed(4)}`));
  console.log('');
  console.log('Per-layer trace (perLayer):');
  Object.entries(result.layerVecs).forEach(([layerId, vec]) => {
    if (vec === null) { console.log(`  ${layerId}: (unanswered)`); return; }
    console.log(`  ${layerId}: ` + DIMS.map(k => `${k}:${vec[k].toFixed(4)}`).join('  '));
  });
  if (result.subacuteStale) {
    console.log('');
    console.log(`Tier S stale sub-layers: ${result.staleSubacuteSubs.join(', ')}`);
  }

  console.log('');
  console.log('--- Full result (JSON, same shape as POST /v1/profile) ---');
  console.log(JSON.stringify({
    respondent_code: respondent.respondent_code,
    date: respondent.date,
    finalScore: result.finalVec,
    perLayer: result.layerVecs,
    answeredSubsTotal: result.answeredSubsTotal,
    totalSubs: result.totalSubs,
    completeness: result.completeness,
    subacuteStale: result.subacuteStale,
    staleSubacuteSubs: result.staleSubacuteSubs,
  }, null, 2));
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/score-respondent.js path/to/respondent.json');
    process.exit(1);
  }
  const respondent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const layers = loadLayers();
  const { result, skipped } = scoreRespondent(respondent, layers);
  printReport(respondent, result, skipped);
}

if (require.main === module) main();

module.exports = { scoreRespondent, resolveSubVector, loadLayers, buildSubIndex };
