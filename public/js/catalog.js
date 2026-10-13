(function () {
  'use strict';

  const listEl = document.getElementById('games-list');
  const emptyEl = document.getElementById('empty-state');
  const errorEl = document.getElementById('error-banner');
  const searchInput = document.getElementById('search-input');
  const minRatingSelect = document.getElementById('min-rating');

  let debounceTimer = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function formatPeriod(game) {
    const start = formatDate(game.playStart);
    const end = game.playEnd ? formatDate(game.playEnd) : 'em andamento';
    return start + ' — ' + end;
  }

  function formatRating(rating) {
    return Number(rating).toLocaleString('pt-BR');
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function buildCard(game) {
    const card = el('article', 'game-card');

    const coverWrap = el('div', 'cover-wrap');
    const img = document.createElement('img');
    img.className = 'cover';
    img.src = game.coverUrl;
    img.alt = 'Capa de ' + game.title;
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      const fallback = el('div', 'cover-fallback', game.title.charAt(0).toUpperCase());
      coverWrap.replaceChild(fallback, img);
    });
    coverWrap.appendChild(img);

    const body = el('div', 'card-body');

    body.appendChild(el('h2', 'game-title', game.title));

    const ratingRow = el('div', 'rating-row');
    const stars = el('span', 'stars-static');
    Stars.render(stars, { rating: Number(game.rating) });
    ratingRow.appendChild(stars);
    ratingRow.appendChild(el('span', 'rating-number', formatRating(game.rating) + ' / 5'));
    body.appendChild(ratingRow);

    body.appendChild(el('p', 'period', formatPeriod(game)));

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

    const editLink = el('a', 'btn btn-small btn-ghost', 'Editar');
    editLink.href = 'form.html?id=' + game.id;

    const deleteBtn = el('button', 'btn btn-small btn-danger', 'Excluir');
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', async function () {
      const confirmed = window.confirm('Excluir "' + game.title + '" do catálogo?');
      if (!confirmed) return;
      try {
        const res = await fetch('/api/games/' + game.id, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        loadGames();
      } catch {
        showError('Não foi possível excluir o jogo.');
      }
    });

    actions.appendChild(editLink);
    actions.appendChild(deleteBtn);
    body.appendChild(actions);

    card.appendChild(coverWrap);
    card.appendChild(body);
    return card;
  }

  function render(games) {
    listEl.textContent = '';
    games.forEach(function (game) {
      listEl.appendChild(buildCard(game));
    });
    emptyEl.hidden = games.length > 0;
  }

  async function loadGames() {
    clearError();
    const params = new URLSearchParams();
    const q = searchInput.value.trim();
    const minRating = minRatingSelect.value;
    if (q) params.set('q', q);
    if (minRating) params.set('minRating', minRating);

    try {
      const res = await fetch('/api/games?' + params.toString());
      if (!res.ok) throw new Error();
      render(await res.json());
    } catch {
      listEl.textContent = '';
      emptyEl.hidden = true;
      showError('Não foi possível carregar os jogos. Verifique se o servidor está rodando.');
    }
  }

  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadGames, 300);
  });

  minRatingSelect.addEventListener('change', loadGames);

  loadGames();
})();
