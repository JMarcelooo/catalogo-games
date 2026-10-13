const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_GAMES_URL = 'https://api.igdb.com/v4/games';
const COVER_BASE = 'https://images.igdb.com/igdb/image/upload/t_cover_big';

const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

let accessToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

async function fetchToken() {
  const params = new URLSearchParams({
    client_id: process.env.IGDB_CLIENT_ID,
    client_secret: process.env.IGDB_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  const response = await fetch(`${TWITCH_TOKEN_URL}?${params}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Falha ao obter token Twitch: HTTP ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  return fetchToken();
}

async function igdbRequest(body, retry = true) {
  const token = await getToken();
  const response = await fetch(IGDB_GAMES_URL, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });

  if (response.status === 401 && retry) {
    await fetchToken();
    return igdbRequest(body, false);
  }
  if (response.status === 429) {
    throw new Error('Limite de requisições do IGDB atingido, tente novamente em instantes');
  }
  if (!response.ok) {
    throw new Error(`Erro na busca do IGDB: HTTP ${response.status}`);
  }

  return response.json();
}

function coverUrl(imageId) {
  return `${COVER_BASE}/${imageId}.jpg`;
}

function getCache(key) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    searchCache.delete(oldest);
  }
  searchCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function searchGames(query) {
  const key = query.trim().toLowerCase();
  const cached = getCache(key);
  if (cached) return cached;

  const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const body =
    `search "${escaped}"; ` +
    'fields id,name,cover.image_id,first_release_date,platforms.name; ' +
    'limit 10;';

  const results = await igdbRequest(body);
  const normalized = results
    .filter((game) => game.cover && game.cover.image_id)
    .map((game) => ({
      igdbId: game.id,
      title: game.name,
      coverUrl: coverUrl(game.cover.image_id),
      releaseYear: game.first_release_date
        ? new Date(game.first_release_date * 1000).getFullYear()
        : null,
      platforms: (game.platforms || []).map((platform) => platform.name),
    }));

  setCache(key, normalized);
  return normalized;
}

module.exports = { isConfigured, searchGames };
