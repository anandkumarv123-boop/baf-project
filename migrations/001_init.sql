-- 001_init.sql — initial schema per BAF_Technical_Architecture.docx Section 3.4 (Data Layer)
--
--   profiles      id, created_at, layer_inputs(json), scores(json)   — one row per generated profile
--   weight_config version, dimension, layer, weight                  — versioned; supports A/B recalibration
--   sessions      id, profile_id, source(web/app)                    — analytics only, no PII
--
-- No physiognomic, medical, or criminal-history fields are persisted anywhere in this schema.

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  layer_inputs JSONB NOT NULL,
  scores       JSONB NOT NULL
);

-- The engine (core-engine.js) applies one scalar weight per layer across all six output
-- dimensions — it does not yet weight per-dimension. `dimension` is carried per the doc's
-- literal schema and reserved for that future per-dimension recalibration; until then every
-- row uses the sentinel '__all__' rather than NULL, so (version, layer, dimension) stays a
-- clean uniqueness key.
CREATE TABLE IF NOT EXISTS weight_config (
  version      INTEGER NOT NULL,
  layer        TEXT NOT NULL,
  dimension    TEXT NOT NULL DEFAULT '__all__',
  weight       NUMERIC(6, 4) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note         TEXT,
  PRIMARY KEY (version, layer, dimension)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_config_version ON weight_config (version);
CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON sessions (profile_id);
