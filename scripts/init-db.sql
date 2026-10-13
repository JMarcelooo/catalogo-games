-- Schema do catálogo de jogos
-- Rodar com: npm run db:init

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  cover_url TEXT NOT NULL,
  igdb_id BIGINT,
  rating NUMERIC(2, 1) NOT NULL
    CHECK (rating >= 0 AND rating <= 5),
  impressions TEXT NOT NULL DEFAULT '',
  play_start DATE NOT NULL,
  play_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT play_end_after_start CHECK (play_end IS NULL OR play_end >= play_start)
);

CREATE INDEX IF NOT EXISTS games_title_idx ON games (title);
CREATE INDEX IF NOT EXISTS games_rating_idx ON games (rating);
CREATE INDEX IF NOT EXISTS games_play_start_idx ON games (play_start);
