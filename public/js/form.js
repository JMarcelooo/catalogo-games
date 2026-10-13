(function () {
  'use strict';

  const form = document.getElementById('game-form');
  const pageTitle = document.getElementById('page-title');
  const editBadge = document.getElementById('edit-badge');
  const searchInput = document.getElementById('igdb-search');
  const searchSpinner = document.getElementById('search-spinner');
  const searchResults = document.getElementById('search-results');
  const searchStatus = document.getElementById('search-status');
  const titleInput = document.getElementById('title');
  const coverInput = document.getElementById('cover-url');
  const coverPreviewWrap = document.getElementById('cover-preview-wrap');
  const coverPreview = document.getElementById('cover-preview');
  const coverRemove = document.getElementById('cover-remove');
  const ratingValue = document.getElementById('rating-value');
  const playStartInput = document.getElementById('play-start');
  const playEndInput = document.getElementById('play-end');
  const inProgressCheck = document.getElementById('in-progress');
  const impressionsInput = document.getElementById('impressions');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('submit-btn');

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get('id');

  let selectedIgdbId = null;
  let searchTimer = null;
  let searchRequest = 0;

  const ratingWidget = Stars.render(document.getElementById('rating-widget'), {
    rating: 0,
    interactive: true,
    onChange: function (rating) {
      ratingValue.textContent = rating.toLocaleString('pt-BR');
    },
  });

  function markInvalid(input, invalid) {
    input.classList.toggle('invalid', invalid);
  }

  function updateCoverPreview() {
    const url = coverInput.value.trim();
    if (!url) {
      coverPreviewWrap.hidden = true;
      coverPreview.removeAttribute('src');
      return;
    }
    coverPreviewWrap.hidden = false;
    coverPreview.src = url;
  }

  coverInput.addEventListener('input', function () {
    selectedIgdbId = null;
    markInvalid(coverInput, false);
    updateCoverPreview();
  });

  coverPreview.addEventListener('error', function () {
    coverPreviewWrap.hidden = true;
  });

  coverRemove.addEventListener('click', function () {
    coverInput.value = '';
    selectedIgdbId = null;
    updateCoverPreview();
    coverInput.focus();
  });

  /* ----------------------------------------------------------
     Busca IGDB
     ---------------------------------------------------------- */
  function hideSearchResults() {
    searchResults.hidden = true;
    searchResults.textContent = '';
  }

  function showStatus(message) {
    searchStatus.textContent = message;
    searchStatus.hidden = false;
  }

  function hideStatus() {
    searchStatus.hidden = true;
    searchStatus.textContent = '';
  }

  function renderSearchResults(results) {
    searchResults.textContent = '';

    if (!results.length) {
      hideSearchResults();
      showStatus('Nenhum jogo encontrado. Preencha os campos manualmente.');
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
      img.addEventListener('error', function () { img.remove(); });

      const info = document.createElement('span');
      info.className = 'search-item-info';

      const name = document.createElement('strong');
      name.textContent = game.title;
      info.appendChild(name);

      const meta = document.createElement('small');
      const parts = [];
      if (game.releaseYear) parts.push(game.releaseYear);
      if (game.platforms && game.platforms.length) parts.push(game.platforms.slice(0, 3).join(', '));
      meta.textContent = parts.join(' · ');
      info.appendChild(meta);

      item.appendChild(img);
      item.appendChild(info);

      item.addEventListener('click', function () {
        titleInput.value = game.title;
        coverInput.value = game.coverUrl;
        selectedIgdbId = game.igdbId;
        markInvalid(titleInput, false);
        markInvalid(coverInput, false);
        searchInput.value = '';
        hideSearchResults();
        hideStatus();
        updateCoverPreview();
        UI.toast('Jogo preenchido a partir do IGDB.', 'success');
      });

      searchResults.appendChild(item);
    });

    searchResults.hidden = false;
    hideStatus();
  }

  async function runSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      hideSearchResults();
      hideStatus();
      return;
    }

    const requestId = ++searchRequest;
    searchSpinner.hidden = false;
    hideSearchResults();
    showStatus('Buscando...');

    try {
      const res = await fetch('/api/games/search?q=' + encodeURIComponent(query));
      const data = await res.json();
      if (requestId !== searchRequest) return;
      if (!res.ok) {
        showStatus(data.error || 'Busca indisponível no momento.');
        return;
      }
      renderSearchResults(data.results);
    } catch {
      if (requestId !== searchRequest) return;
      showStatus('Erro ao buscar. Preencha os campos manualmente.');
    } finally {
      if (requestId === searchRequest) searchSpinner.hidden = true;
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
    } else if (event.key === 'Escape') {
      hideSearchResults();
    }
  });

  document.addEventListener('click', function (event) {
    if (!searchResults.contains(event.target) && event.target !== searchInput) {
      hideSearchResults();
    }
  });

  /* ----------------------------------------------------------
     Período
     ---------------------------------------------------------- */
  playStartInput.addEventListener('change', function () {
    markInvalid(playStartInput, false);
    playEndInput.min = playStartInput.value || '';
    if (playEndInput.value && playEndInput.value < playStartInput.value) {
      playEndInput.value = '';
    }
  });

  playEndInput.addEventListener('change', function () {
    markInvalid(playEndInput, false);
  });

  inProgressCheck.addEventListener('change', function () {
    playEndInput.disabled = inProgressCheck.checked;
    if (inProgressCheck.checked) playEndInput.value = '';
  });

  /* ----------------------------------------------------------
     Impressões: contador
     ---------------------------------------------------------- */
  impressionsInput.addEventListener('input', function () {
    charCount.textContent = String(impressionsInput.value.length);
  });

  /* ----------------------------------------------------------
     Validação e envio
     ---------------------------------------------------------- */
  function validate() {
    const title = titleInput.value.trim();
    const cover = coverInput.value.trim();

    markInvalid(titleInput, !title);
    if (!title) {
      titleInput.focus();
      return 'Informe o título do jogo';
    }

    let coverValid = false;
    try {
      const url = new URL(cover);
      coverValid = cover && (url.protocol === 'http:' || url.protocol === 'https:');
    } catch {
      coverValid = false;
    }
    markInvalid(coverInput, !coverValid);
    if (!coverValid) {
      coverInput.focus();
      return 'Informe uma URL de capa válida (http/https)';
    }

    markInvalid(playStartInput, !playStartInput.value);
    if (!playStartInput.value) {
      playStartInput.focus();
      return 'Informe a data inicial do período';
    }

    const playEnd = playEndInput.value;
    if (playEnd && playEnd < playStartInput.value) {
      markInvalid(playEndInput, true);
      playEndInput.focus();
      return 'A data final não pode ser anterior à data inicial';
    }

    return null;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      UI.toast(validationError, 'error');
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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    try {
      const url = editingId ? '/api/games/' + editingId : '/api/games';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        UI.toast(data.error || 'Erro ao salvar o jogo.', 'error');
        return;
      }
      UI.toast(editingId ? 'Jogo atualizado!' : 'Jogo adicionado ao catálogo!', 'success');
      setTimeout(function () { window.location.href = 'index.html'; }, 600);
    } catch {
      UI.toast('Não foi possível salvar. Verifique se o servidor está rodando.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingId ? 'Salvar alterações' : 'Salvar jogo';
    }
  });

  /* ----------------------------------------------------------
     Modo edição
     ---------------------------------------------------------- */
  async function loadGame() {
    try {
      const res = await fetch('/api/games/' + editingId);
      if (!res.ok) throw new Error();
      const game = await res.json();

      pageTitle.textContent = 'Editar jogo';
      document.title = 'Editar jogo — Catálogo de Jogos';
      editBadge.hidden = false;
      submitBtn.textContent = 'Salvar alterações';

      titleInput.value = game.title;
      coverInput.value = game.coverUrl;
      selectedIgdbId = game.igdbId ? Number(game.igdbId) : null;
      ratingWidget.rating = Number(game.rating);
      ratingValue.textContent = Number(game.rating).toLocaleString('pt-BR');
      playStartInput.value = game.playStart;
      playEndInput.min = game.playStart;
      if (game.playEnd) playEndInput.value = game.playEnd;
      impressionsInput.value = game.impressions || '';
      charCount.textContent = String(impressionsInput.value.length);
      updateCoverPreview();
    } catch {
      UI.toast('Jogo não encontrado.', 'error');
      setTimeout(function () { window.location.href = 'index.html'; }, 1200);
    }
  }

  if (editingId) loadGame();
})();
