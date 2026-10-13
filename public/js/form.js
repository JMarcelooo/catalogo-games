(function () {
  'use strict';

  const form = document.getElementById('game-form');
  const pageTitle = document.getElementById('page-title');
  const searchInput = document.getElementById('igdb-search');
  const searchResults = document.getElementById('search-results');
  const searchStatus = document.getElementById('search-status');
  const titleInput = document.getElementById('title');
  const coverInput = document.getElementById('cover-url');
  const coverPreview = document.getElementById('cover-preview');
  const ratingValue = document.getElementById('rating-value');
  const playStartInput = document.getElementById('play-start');
  const playEndInput = document.getElementById('play-end');
  const inProgressCheck = document.getElementById('in-progress');
  const impressionsInput = document.getElementById('impressions');
  const formError = document.getElementById('form-error');

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get('id');

  let selectedIgdbId = null;
  let searchTimer = null;
  let searchRequest = 0;

  const ratingWidget = Stars.render(document.getElementById('rating-widget'), {
    rating: 0,
    interactive: true,
    onChange: function (rating) {
      ratingValue.textContent = rating.toLocaleString('pt-BR') + ' / 5';
    },
  });

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearError() {
    formError.hidden = true;
    formError.textContent = '';
  }

  function updateCoverPreview() {
    const url = coverInput.value.trim();
    if (!url) {
      coverPreview.hidden = true;
      return;
    }
    coverPreview.src = url;
    coverPreview.hidden = false;
  }

  coverInput.addEventListener('input', function () {
    selectedIgdbId = null;
    updateCoverPreview();
  });

  coverPreview.addEventListener('error', function () {
    coverPreview.hidden = true;
  });

  function hideSearchResults() {
    searchResults.hidden = true;
    searchResults.textContent = '';
  }

  function renderSearchResults(results) {
    searchResults.textContent = '';
    if (!results.length) {
      hideSearchResults();
      searchStatus.textContent = 'Nenhum jogo encontrado. Preencha manualmente.';
      searchStatus.hidden = false;
      return;
    }

    results.forEach(function (game) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'search-item';

      const img = document.createElement('img');
      img.src = game.coverUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        img.remove();
      });

      const info = document.createElement('span');
      info.className = 'search-item-info';

      const name = document.createElement('strong');
      name.textContent = game.title;
      info.appendChild(name);

      const meta = document.createElement('small');
      const parts = [];
      if (game.releaseYear) parts.push(game.releaseYear);
      if (game.platforms && game.platforms.length) {
        parts.push(game.platforms.slice(0, 3).join(', '));
      }
      meta.textContent = parts.join(' · ');
      info.appendChild(meta);

      item.appendChild(img);
      item.appendChild(info);

      item.addEventListener('click', function () {
        titleInput.value = game.title;
        coverInput.value = game.coverUrl;
        selectedIgdbId = game.igdbId;
        hideSearchResults();
        searchInput.value = '';
        searchStatus.hidden = true;
        clearError();
        updateCoverPreview();
      });

      searchResults.appendChild(item);
    });
    searchResults.hidden = false;
    searchStatus.hidden = true;
  }

  async function runSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      hideSearchResults();
      searchStatus.hidden = true;
      return;
    }

    const requestId = ++searchRequest;
    searchStatus.textContent = 'Buscando...';
    searchStatus.hidden = false;
    hideSearchResults();

    try {
      const res = await fetch('/api/games/search?q=' + encodeURIComponent(query));
      const data = await res.json();
      if (requestId !== searchRequest) return;
      if (!res.ok) {
        searchStatus.textContent = data.error || 'Busca indisponível.';
        searchStatus.hidden = false;
        return;
      }
      renderSearchResults(data.results);
    } catch {
      if (requestId !== searchRequest) return;
      searchStatus.textContent = 'Erro ao buscar. Preencha os campos manualmente.';
      searchStatus.hidden = false;
    }
  }

  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 400);
  });

  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(searchTimer);
      runSearch();
    }
  });

  document.addEventListener('click', function (event) {
    if (!searchResults.contains(event.target) && event.target !== searchInput) {
      hideSearchResults();
    }
  });

  inProgressCheck.addEventListener('change', function () {
    playEndInput.disabled = inProgressCheck.checked;
    if (inProgressCheck.checked) playEndInput.value = '';
  });

  function validate() {
    if (!titleInput.value.trim()) return 'Informe o título do jogo';
    if (!coverInput.value.trim()) return 'Informe a URL da capa';

    try {
      const url = new URL(coverInput.value.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    } catch {
      return 'A URL da capa deve começar com http:// ou https://';
    }

    if (!playStartInput.value) return 'Informe a data inicial do período';

    const playEnd = playEndInput.value;
    if (playEnd && playEnd < playStartInput.value) {
      return 'A data final não pode ser anterior à data inicial';
    }
    return null;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearError();

    const validationError = validate();
    if (validationError) {
      showError(validationError);
      return;
    }

    const payload = {
      title: titleInput.value.trim(),
      coverUrl: coverInput.value.trim(),
      rating: ratingWidget.rating,
      impressions: impressionsInput.value.trim(),
      playStart: playStartInput.value,
      playEnd: inProgressCheck.checked ? '' : playEndInput.value,
      igdbId: selectedIgdbId,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const url = editingId ? '/api/games/' + editingId : '/api/games';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(data.error || 'Erro ao salvar o jogo.');
        return;
      }
      window.location.href = 'index.html';
    } catch {
      showError('Não foi possível salvar. Verifique se o servidor está rodando.');
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function loadGame() {
    try {
      const res = await fetch('/api/games/' + editingId);
      if (!res.ok) throw new Error();
      const game = await res.json();

      pageTitle.textContent = 'Editar jogo';
      titleInput.value = game.title;
      coverInput.value = game.coverUrl;
      selectedIgdbId = game.igdbId ? Number(game.igdbId) : null;
      ratingWidget.rating = Number(game.rating);
      ratingValue.textContent = Number(game.rating).toLocaleString('pt-BR') + ' / 5';
      playStartInput.value = game.playStart;
      if (game.playEnd) playEndInput.value = game.playEnd;
      impressionsInput.value = game.impressions || '';
      updateCoverPreview();
    } catch {
      showError('Jogo não encontrado.');
    }
  }

  if (editingId) loadGame();
})();
