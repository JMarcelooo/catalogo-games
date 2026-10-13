(function () {
  'use strict';

  const listEl = document.getElementById('games-list');
  const emptyEl = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyMsg = document.getElementById('empty-msg');
  const emptyCta = document.getElementById('empty-cta');
  const emptyClear = document.getElementById('empty-clear');
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');
  const minRatingSelect = document.getElementById('min-rating');
  const sortSelect = document.getElementById('sort-select');
  const resultCount = document.getElementById('result-count');
  const statsEl = document.getElementById('stats');
  const statTotal = document.getElementById('stat-total');
  const statAvg = document.getElementById('stat-avg');
  const statPlayingWrap = document.getElementById('stat-playing-wrap');
  const statPlaying = document.getElementById('stat-playing');

  let debounceTimer = null;
  let games = [];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function svgIcon(path, className) {
    const span = document.createElement('span');
    span.className = className || '';
    span.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true">' +
      path + '</svg>';
    return span;
  }

  const ICON_CALENDAR =
    '<rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>' +
    '<line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>';
  const ICON_STAR = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';

  function formatDate(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function formatPeriod(game) {
    return formatDate(game.playStart) + ' — ' + (game.playEnd ? formatDate(game.playEnd) : 'em andamento');
  }

  function formatRating(rating) {
    return Number(rating).toLocaleString('pt-BR');
  }

  function hasFilters() {
    return Boolean(searchInput.value.trim() || minRatingSelect.value);
  }

  function showSkeletons() {
    listEl.setAttribute('aria-busy', 'true');
    listEl.textContent = '';
    for (let i = 0; i < 8; i++) {
      const card = el('div', 'skeleton-card');
      const cover = el('div', 'skeleton-cover sk');
      const body = el('div', 'skeleton-body');
      body.appendChild(el('div', 'sk sk-title'));
      body.appendChild(el('div', 'sk sk-line'));
      body.appendChild(el('div', 'sk sk-chip'));
      card.appendChild(cover);
      card.appendChild(body);
      listEl.appendChild(card);
    }
    emptyEl.hidden = true;
  }

  function updateStats() {
    if (!games.length) {
      statsEl.hidden = true;
      return;
    }
    const total = games.length;
    const avg = games.reduce(function (sum, g) { return sum + Number(g.rating); }, 0) / total;
    const playing = games.filter(function (g) { return !g.playEnd; }).length;

    statTotal.textContent = String(total);
    statAvg.textContent = avg.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    statPlaying.textContent = String(playing);
    statPlayingWrap.hidden = playing === 0;
    statsEl.hidden = false;
  }

  function sortGames(list) {
    const copy = list.slice();
    if (sortSelect.value === 'rating') {
      copy.sort(function (a, b) {
        return Number(b.rating) - Number(a.rating) || b.playStart.localeCompare(a.playStart);
      });
    } else if (sortSelect.value === 'title') {
      copy.sort(function (a, b) {
        return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
      });
    } else {
      copy.sort(function (a, b) {
        return b.playStart.localeCompare(a.playStart) || b.id - a.id;
      });
    }
    return copy;
  }

  function buildCard(game, index) {
    const card = el('article', 'game-card');
    card.style.animationDelay = Math.min(index * 55, 440) + 'ms';

    const coverWrap = el('div', 'cover-wrap');
    const img = document.createElement('img');
    img.className = 'cover';
    img.src = game.coverUrl;
    img.alt = 'Capa de ' + game.title;
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      coverWrap.replaceChild(el('div', 'cover-fallback', game.title.charAt(0).toUpperCase()), img);
    });
    coverWrap.appendChild(img);

    const badge = el('span', 'rating-badge');
    badge.appendChild(svgIcon(ICON_STAR));
    badge.appendChild(document.createTextNode(formatRating(game.rating)));
    coverWrap.appendChild(badge);

    const body = el('div', 'card-body');
    body.appendChild(el('h2', 'game-title', game.title));

    const ratingRow = el('div', 'rating-row');
    const stars = el('span', 'stars-static');
    Stars.render(stars, { rating: Number(game.rating) });
    ratingRow.appendChild(stars);
    ratingRow.appendChild(el('span', 'rating-number', formatRating(game.rating) + ' / 5'));
    body.appendChild(ratingRow);

    const chip = el('span', 'period-chip');
    if (!game.playEnd) {
      chip.appendChild(el('span', 'dot'));
      chip.appendChild(document.createTextNode('Em andamento · desde ' + formatDate(game.playStart)));
    } else {
      chip.appendChild(svgIcon(ICON_CALENDAR));
      chip.appendChild(document.createTextNode(formatPeriod(game)));
    }
    body.appendChild(chip);

    if (game.impressions) {
      const impressions = el('p', 'impressions', game.impressions);
      body.appendChild(impressions);

      requestAnimationFrame(function () {
        if (impressions.scrollHeight > impressions.clientHeight + 4) {
          const toggle = el('button', 'link-btn', 'ler mais');
          toggle.type = 'button';
          toggle.addEventListener('click', function () {
            const expanded = impressions.classList.toggle('expanded');
            toggle.textContent = expanded ? 'mostrar menos' : 'ler mais';
          });
          body.appendChild(toggle);
        }
      });
    }

    const actions = el('div', 'card-actions');

    const editLink = el('a', 'btn btn-ghost', 'Editar');
    editLink.href = 'form.html?id=' + game.id;

    const deleteBtn = el('button', 'btn btn-danger', 'Excluir');
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', async function () {
      const confirmed = await UI.confirm({
        title: 'Excluir jogo',
        message: 'Remover "' + game.title + '" do catálogo? Essa ação não pode ser desfeita.',
        confirmText: 'Excluir',
      });
      if (!confirmed) return;
      try {
        const res = await fetch('/api/games/' + game.id, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        UI.toast('Jogo excluído do catálogo.', 'success');
        await loadGames({ silent: true });
      } catch {
        UI.toast('Não foi possível excluir o jogo.', 'error');
      }
    });

    actions.appendChild(editLink);
    actions.appendChild(deleteBtn);
    body.appendChild(actions);

    card.appendChild(coverWrap);
    card.appendChild(body);
    return card;
  }

  function render() {
    const sorted = sortGames(games);
    listEl.textContent = '';
    sorted.forEach(function (game, index) {
      listEl.appendChild(buildCard(game, index));
    });
    listEl.setAttribute('aria-busy', 'false');

    const filtered = hasFilters();
    emptyEl.hidden = games.length > 0;

    if (!games.length) {
      if (filtered) {
        emptyTitle.textContent = 'Nenhum resultado';
        emptyMsg.textContent = 'Nenhum jogo corresponde aos filtros aplicados.';
        emptyCta.hidden = true;
        emptyClear.hidden = false;
      } else {
        emptyTitle.textContent = 'Seu catálogo está vazio';
        emptyMsg.textContent = 'Adicione o primeiro jogo e comece a registrar suas jogatinas.';
        emptyCta.hidden = false;
        emptyClear.hidden = true;
      }
    }

    if (games.length) {
      resultCount.textContent = games.length === 1
        ? '1 jogo'
        : games.length + ' jogos';
      resultCount.hidden = false;
    } else {
      resultCount.hidden = true;
    }

    updateStats();
  }

  async function loadGames(options) {
    const opts = options || {};
    if (!opts.silent) showSkeletons();
    clearBtn.hidden = !searchInput.value;

    const params = new URLSearchParams();
    const q = searchInput.value.trim();
    if (q) params.set('q', q);
    if (minRatingSelect.value) params.set('minRating', minRatingSelect.value);

    try {
      const res = await fetch('/api/games?' + params.toString());
      if (!res.ok) throw new Error();
      games = await res.json();
      render();
    } catch {
      listEl.textContent = '';
      listEl.setAttribute('aria-busy', 'false');
      emptyEl.hidden = false;
      emptyTitle.textContent = 'Erro ao carregar';
      emptyMsg.textContent = 'Não foi possível buscar os jogos. Verifique se o servidor está rodando.';
      emptyCta.hidden = true;
      emptyClear.hidden = true;
      UI.toast('Falha ao carregar o catálogo.', 'error');
    }
  }

  function scheduleLoad() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { loadGames({ silent: true }); }, 300);
  }

  searchInput.addEventListener('input', function () {
    clearBtn.hidden = !searchInput.value;
    scheduleLoad();
  });

  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    clearBtn.hidden = true;
    searchInput.focus();
    loadGames({ silent: true });
  });

  minRatingSelect.addEventListener('change', function () { loadGames({ silent: true }); });
  sortSelect.addEventListener('change', render);

  emptyClear.addEventListener('click', function () {
    searchInput.value = '';
    minRatingSelect.value = '';
    clearBtn.hidden = true;
    loadGames({ silent: true });
  });

  loadGames();
})();
