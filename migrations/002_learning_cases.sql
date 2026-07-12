-- 002_learning_cases.sql — "learning case" log for the continuous-improvement external
-- validation layer (scripts/scenario-bank.js, scripts/consistency-check.js). Each row
-- compares one existing profile's engine output against that respondent's scenario-based
-- decisions. This table is additive infrastructure sitting alongside the scoring engine --
-- it does not feed back into profiles.scores or core-engine.js in any way.
--
-- PRIVACY: respondent_code is an opaque identifier only (e.g. 'R-0042'). No name,
-- location, employer, or any other re-identifying field is stored here or anywhere else
-- in this schema. No passive behavioral signal capture (mouse/keystroke/timing) is
-- collected or stored. Section 10-style external-rater data (spouse/friend/manager
-- ratings) is out of scope for this table and is not implemented anywhere in this system.

CREATE TYPE learning_case_status AS ENUM ('new', 'reviewed', 'actioned');

CREATE TABLE IF NOT EXISTS learning_cases (
  id                 UUID PRIMARY KEY,
  respondent_code    TEXT NOT NULL,
  date               TIMESTAMPTZ NOT NULL DEFAULT now(),
  profile_id         UUID NOT NULL REFERENCES profiles(id),
  scenario_answers   JSONB NOT NULL,
  consistency_report JSONB NOT NULL,
  reviewer_notes     TEXT,
  status             learning_case_status NOT NULL DEFAULT 'new',
  version            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_cases_profile_id ON learning_cases (profile_id);
CREATE INDEX IF NOT EXISTS idx_learning_cases_status ON learning_cases (status);
