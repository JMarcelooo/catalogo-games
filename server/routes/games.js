const express = require('express');
const db = require('../db');
const igdb = require('../igdb');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) return null;
  if (Math.abs(rating * 2 - Math.round(rating * 2)) > 1e-9) return null;
  return rating;
}

function validateGame(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const coverUrl = typeof body.coverUrl === 'string' ? body.coverUrl.trim() : '';
  const impressions = typeof body.impressions === 'string' ? body.impressions.trim() : '';
  const playStart = typeof body.playStart === 'string' ? body.playStart.trim() : '';
  const playEnd = typeof body.playEnd === 'string' ? body.playEnd.trim() : '';

  if (!title) return { error: 'Informe o título do jogo' };
  if (title.length > 255) return { error: 'Título muito longo (máx. 255 caracteres)' };

  let cover;
  try {
    const parsed = new URL(coverUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    cover = coverUrl;
  } catch {
    return { error: 'Informe uma URL de imagem válida (http/https)' };
  }

  const rating = parseRating(body.rating);
  if (rating === null) return { error: 'A nota deve estar entre 0 e 5, em passos de 0.5' };

  if (!DATE_RE.test(playStart)) return { error: 'Informe a data inicial do período' };

  if (playEnd && !DATE_RE.test(playEnd)) return { error: 'Data final inválida' };
  if (playEnd && playEnd < playStart) {
    return { error: 'A data final não pode ser anterior à data inicial' };
  }

  const igdbId = Number.isInteger(Number(body.igdbId)) && Number(body.igdbId) > 0
    ? Number(body.igdbId)
    : null;

  return { value: { title, coverUrl: cover, rating, impressions, playStart, playEnd: playEnd || null, igdbId } };
}

const SELECT_GAME = `
  SELECT id, title, cover_url AS "coverUrl", igdb_id AS "igdbId",
         rating, impressions,
         to_char(play_start, 'YYYY-MM-DD') AS "playStart",
         to_char(play_end, 'YYYY-MM-DD') AS "playEnd",
         created_at AS "createdAt"
  FROM games
`;

router.get('/', async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      conditions.push(`title ILIKE $${params.length}`);
    }
    if (req.query.minRating !== undefined && req.query.minRating !== '') {
      const minRating = parseRating(req.query.minRating);
      if (minRating === null) {
        return res.status(400).json({ error: 'Nota mínima inválida' });
      }
      params.push(minRating);
      conditions.push(`rating >= $${params.length}`);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `${SELECT_GAME}${where} ORDER BY play_start DESC, id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const { rows } = await db.query(`${SELECT_GAME} WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Jogo não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = validateGame(req.body);
    if (error) return res.status(400).json({ error });

    const { rows } = await db.query(
      `INSERT INTO games (title, cover_url, igdb_id, rating, impressions, play_start, play_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, cover_url AS "coverUrl", igdb_id AS "igdbId", rating,
                 impressions,
                 to_char(play_start, 'YYYY-MM-DD') AS "playStart",
                 to_char(play_end, 'YYYY-MM-DD') AS "playEnd",
                 created_at AS "createdAt"`,
      [value.title, value.coverUrl, value.igdbId, value.rating, value.impressions, value.playStart, value.playEnd]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id(\\d+)', async (req, res, next) => {
  try {
    const { error, value } = validateGame(req.body);
    if (error) return res.status(400).json({ error });

    const { rows } = await db.query(
      `UPDATE games
       SET title = $1, cover_url = $2, igdb_id = $3, rating = $4,
           impressions = $5, play_start = $6, play_end = $7
       WHERE id = $8
       RETURNING id, title, cover_url AS "coverUrl", igdb_id AS "igdbId", rating,
                 impressions,
                 to_char(play_start, 'YYYY-MM-DD') AS "playStart",
                 to_char(play_end, 'YYYY-MM-DD') AS "playEnd",
                 created_at AS "createdAt"`,
      [value.title, value.coverUrl, value.igdbId, value.rating, value.impressions, value.playStart, value.playEnd, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Jogo não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id(\\d+)', async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM games WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Jogo não encontrado' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2) {
    return res.status(400).json({ error: 'Digite ao menos 2 caracteres' });
  }
  if (!igdb.isConfigured()) {
    return res.status(503).json({
      error: 'Busca automática indisponível: configure IGDB_CLIENT_ID e IGDB_CLIENT_SECRET no .env',
      results: [],
    });
  }

  try {
    const results = await igdb.searchGames(query);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
