// store.js — Postgres persistence.
// Schema: migrations/001_init.sql (BAF_Technical_Architecture.docx Section 3.4 — profiles / weight_config / sessions).
// Exported function names/params are unchanged from the JSON-file phase. They are now
// async (pg has no synchronous driver), so callers in server.js await them.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://baf:baf@localhost:5432/baf',
});

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

// profiles.layer_inputs holds profile.input ({precisionVectors, microVectors, subacuteTimestamps});
// profiles.scores holds everything computeEngine produced plus the narrative/disclaimer.
async function saveProfile(profile) {
  const scores = {
    finalScore: profile.finalScore,
    perLayer: profile.perLayer,
    answeredSubsTotal: profile.answeredSubsTotal,
    totalSubs: profile.totalSubs,
    completeness: profile.completeness,
    confidence: profile.confidence,
    subacuteStale: profile.subacuteStale,
    staleSubacuteSubs: profile.staleSubacuteSubs,
    narrative: profile.narrative,
    disclaimer: profile.disclaimer,
  };
  await pool.query(
    `INSERT INTO profiles (id, created_at, layer_inputs, scores)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       created_at = EXCLUDED.created_at,
       layer_inputs = EXCLUDED.layer_inputs,
       scores = EXCLUDED.scores`,
    [profile.id, profile.created_at, JSON.stringify(profile.input), JSON.stringify(scores)]
  );
  return profile;
}

async function getProfile(id) {
  const { rows } = await pool.query(
    'SELECT id, created_at, layer_inputs, scores FROM profiles WHERE id = $1',
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    created_at: toIso(row.created_at),
    input: row.layer_inputs,
    ...row.scores,
  };
}

async function listProfiles() {
  const { rows } = await pool.query(
    'SELECT id, created_at, scores FROM profiles ORDER BY created_at ASC'
  );
  return rows.map(row => ({
    id: row.id,
    created_at: toIso(row.created_at),
    completeness: row.scores.completeness,
  }));
}

// entry: { version, published_at, weights: {layerId: weight}, note }
async function saveWeightVersion(entry) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [layer, weight] of Object.entries(entry.weights)) {
      await client.query(
        `INSERT INTO weight_config (version, layer, weight, published_at, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (version, layer, dimension) DO UPDATE SET
           weight = EXCLUDED.weight,
           published_at = EXCLUDED.published_at,
           note = EXCLUDED.note`,
        [entry.version, layer, weight, entry.published_at, entry.note || null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return entry;
}

async function getWeightVersion(version) {
  let targetVersion = version;
  if (version === 'latest') {
    const { rows } = await pool.query('SELECT MAX(version) AS v FROM weight_config');
    targetVersion = rows[0].v;
    if (targetVersion === null) return null;
  }

  const { rows } = await pool.query(
    'SELECT version, layer, weight, published_at, note FROM weight_config WHERE version = $1',
    [targetVersion]
  );
  if (!rows.length) return null;

  const weights = {};
  rows.forEach(row => { weights[row.layer] = Number(row.weight); });
  return {
    version: rows[0].version,
    published_at: toIso(rows[0].published_at),
    weights,
    note: rows[0].note,
  };
}

// entry: { id, respondent_code, date, profile_id, scenario_answers, consistency_report,
//          reviewer_notes, status, version } -- see migrations/002_learning_cases.sql.
async function saveLearningCase(entry) {
  await pool.query(
    `INSERT INTO learning_cases
       (id, respondent_code, date, profile_id, scenario_answers, consistency_report, reviewer_notes, status, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.id, entry.respondent_code, entry.date, entry.profile_id,
      JSON.stringify(entry.scenario_answers), JSON.stringify(entry.consistency_report),
      entry.reviewer_notes || null, entry.status, entry.version,
    ]
  );
  return entry;
}

async function getLearningCase(id) {
  const { rows } = await pool.query(
    `SELECT id, respondent_code, date, profile_id, scenario_answers, consistency_report, reviewer_notes, status, version
     FROM learning_cases WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, date: toIso(row.date) };
}

async function listLearningCases({ status } = {}) {
  const params = [];
  let sql = 'SELECT id, respondent_code, date, profile_id, status, version FROM learning_cases';
  if (status) {
    params.push(status);
    sql += ` WHERE status = $${params.length}`;
  }
  sql += ' ORDER BY date ASC';
  const { rows } = await pool.query(sql, params);
  return rows.map(row => ({ ...row, date: toIso(row.date) }));
}

module.exports = {
  saveProfile, getProfile, listProfiles, saveWeightVersion, getWeightVersion,
  saveLearningCase, getLearningCase, listLearningCases, pool,
};
